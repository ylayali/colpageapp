'use client';

import { ColoringForm, type ColoringFormData, type MultiPersonFormData, generatePrompt } from '@/components/coloring-form';
import { ColoringOutput } from '@/components/coloring-output';
import { AuthDialog } from '@/components/auth-dialog';
import { PasswordDialog } from '@/components/password-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth-context';
import { useCredits as consumeCredits } from '@/lib/credit-utils';
import { db, type ImageRecord } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import * as React from 'react';

type ApiImageResponseItem = {
    filename: string;
    b64_json?: string;
    output_format: string;
    path?: string;
};

const explicitModeClient = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
const vercelEnvClient = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isOnVercelClient = vercelEnvClient === 'production' || vercelEnvClient === 'preview';

let effectiveStorageModeClient: 'fs' | 'indexeddb';

if (explicitModeClient === 'fs') {
    effectiveStorageModeClient = 'fs';
} else if (explicitModeClient === 'indexeddb') {
    effectiveStorageModeClient = 'indexeddb';
} else if (isOnVercelClient) {
    effectiveStorageModeClient = 'indexeddb';
} else {
    effectiveStorageModeClient = 'fs';
}

export default function HomePage() {
    const [isPasswordRequiredByBackend, setIsPasswordRequiredByBackend] = React.useState<boolean | null>(null);
    const [clientPasswordHash, setClientPasswordHash] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [latestImageBatch, setLatestImageBatch] = React.useState<{ path: string; filename: string }[] | null>(null);
    const [blobUrlCache, setBlobUrlCache] = React.useState<Record<string, string>>({});
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
    const [passwordDialogContext, setPasswordDialogContext] = React.useState<'initial' | 'retry'>('initial');
    const [lastApiCallArgs, setLastApiCallArgs] = React.useState<[ColoringFormData] | [MultiPersonFormData, 'multi'] | null>(null);
    const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
    
    // Use real authentication system
    const { user, refreshCredits } = useAuth();

    // Keep this for potential future use
    useLiveQuery<ImageRecord[] | undefined>(() => db.images.toArray(), []);

    React.useEffect(() => {
        return () => {
            console.log('Revoking blob URLs:', Object.keys(blobUrlCache).length);
            Object.values(blobUrlCache).forEach((url) => {
                if (url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, [blobUrlCache]);

    React.useEffect(() => {
        const fetchAuthStatus = async () => {
            try {
                const response = await fetch('/api/auth-status');
                if (!response.ok) {
                    throw new Error('Failed to fetch auth status');
                }
                const data = await response.json();
                setIsPasswordRequiredByBackend(data.passwordRequired);
            } catch (error) {
                console.error('Error fetching auth status:', error);
                setIsPasswordRequiredByBackend(false);
            }
        };

        fetchAuthStatus();
        const storedHash = localStorage.getItem('clientPasswordHash');
        if (storedHash) {
            setClientPasswordHash(storedHash);
        }
    }, []);

    async function sha256Client(text: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    const handleSavePassword = async (password: string) => {
        if (!password.trim()) {
            setError('Password cannot be empty.');
            return;
        }
        try {
            const hash = await sha256Client(password);
            localStorage.setItem('clientPasswordHash', hash);
            setClientPasswordHash(hash);
            setError(null);
            setIsPasswordDialogOpen(false);
            if (passwordDialogContext === 'retry' && lastApiCallArgs) {
                console.log('Retrying API call after password save...');
                if (lastApiCallArgs.length === 2 && lastApiCallArgs[1] === 'multi') {
                    await handleMultiPersonApiCall(lastApiCallArgs[0] as MultiPersonFormData);
                } else {
                    await handleApiCall(lastApiCallArgs[0] as ColoringFormData);
                }
            }
        } catch (e) {
            console.error('Error hashing password:', e);
            setError('Failed to save password due to a hashing error.');
        }
    };


    const getMimeTypeFromFormat = (format: string): string => {
        if (format === 'jpeg') return 'image/jpeg';
        if (format === 'webp') return 'image/webp';
        return 'image/png';
    };

    const handleApiCall = async (formData: ColoringFormData) => {
        const startTime = Date.now();
        let durationMs = 0;

        setIsLoading(true);
        setError(null);
        setLatestImageBatch(null);

        // Check if user is authenticated
        if (!user) {
            setError('Please sign in to generate images.');
            setIsLoading(false);
            return;
        }

        // Check if user has enough credits (1 credit for single person)
        const REQUIRED_CREDITS = 1;
        if (user.credits < REQUIRED_CREDITS) {
            setError('You have no credits remaining. Please visit your GrooveFunnels account to manage your subscription or start a free trial.');
            setIsLoading(false);
            return;
        }

        // Create photo preview URL for loading state
        let previewUrl: string | null = null;
        if (formData.photo) {
            previewUrl = URL.createObjectURL(formData.photo);
            setPhotoPreview(previewUrl);
        }

        const apiFormData = new FormData();
        if (isPasswordRequiredByBackend && clientPasswordHash) {
            apiFormData.append('passwordHash', clientPasswordHash);
        } else if (isPasswordRequiredByBackend && !clientPasswordHash) {
            setError('Password is required. Please configure the password by clicking the lock icon.');
            setPasswordDialogContext('initial');
            setIsPasswordDialogOpen(true);
            setIsLoading(false);
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPhotoPreview(null);
            }
            return;
        }

        // Add user email for credit checking
        apiFormData.append('userEmail', user.email);

        // Ensure photo exists
        if (!formData.photo) {
            setError('Photo is required for coloring page generation.');
            setIsLoading(false);
            return;
        }

        // Generate the prompt based on form data
        const prompt = generatePrompt(formData);
        
        // Set size based on orientation
        const imageSize = formData.orientation === 'landscape' ? '1536x1024' : '1024x1536';
        
        apiFormData.append('mode', 'generate');
        apiFormData.append('prompt', prompt);
        apiFormData.append('n', '1');
        apiFormData.append('size', imageSize);
        apiFormData.append('quality', 'high');
        apiFormData.append('output_format', 'png');
        apiFormData.append('background', 'auto');
        apiFormData.append('moderation', 'auto');
        
        // Add the photo as an image file for the API
        apiFormData.append('image_0', formData.photo, formData.photo.name);

        console.log('Sending request to /api/images with coloring page data');
        console.log('Generated prompt:', prompt);

        try {
            const response = await fetch('/api/images', {
                method: 'POST',
                body: apiFormData
            });

            const result = await response.json();

            if (!response.ok) {
            if (response.status === 401 && isPasswordRequiredByBackend) {
                setError('Unauthorized: Invalid or missing password. Please try again.');
                setPasswordDialogContext('retry');
                setLastApiCallArgs([formData]);
                setIsPasswordDialogOpen(true);
                return;
            }
                throw new Error(result.error || `API request failed with status ${response.status}`);
            }

            console.log('API Response:', result);

            if (result.images && result.images.length > 0) {
                durationMs = Date.now() - startTime;
                console.log(`API call successful. Duration: ${durationMs}ms`);

                // Credits are deducted by the backend API
                // Just refresh to get updated credit count
                refreshCredits();

                let newImageBatchPromises: Promise<{ path: string; filename: string } | null>[] = [];
                if (effectiveStorageModeClient === 'indexeddb') {
                    console.log('Processing images for IndexedDB storage...');
                    newImageBatchPromises = result.images.map(async (img: ApiImageResponseItem) => {
                        if (img.b64_json) {
                            try {
                                const byteCharacters = atob(img.b64_json);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let i = 0; i < byteCharacters.length; i++) {
                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                }
                                const byteArray = new Uint8Array(byteNumbers);

                                const actualMimeType = getMimeTypeFromFormat(img.output_format);
                                const blob = new Blob([byteArray], { type: actualMimeType });

                                await db.images.put({ filename: img.filename, blob });
                                console.log(`Saved ${img.filename} to IndexedDB with type ${actualMimeType}.`);

                                const blobUrl = URL.createObjectURL(blob);
                                setBlobUrlCache((prev) => ({ ...prev, [img.filename]: blobUrl }));

                                return { filename: img.filename, path: blobUrl };
                            } catch (dbError) {
                                console.error(`Error saving blob ${img.filename} to IndexedDB:`, dbError);
                                setError(`Failed to save image ${img.filename} to local database.`);
                                return null;
                            }
                        } else {
                            console.warn(`Image ${img.filename} missing b64_json in indexeddb mode.`);
                            return null;
                        }
                    });
                } else {
                    newImageBatchPromises = result.images
                        .filter((img: ApiImageResponseItem) => !!img.path)
                        .map((img: ApiImageResponseItem) =>
                            Promise.resolve({
                                path: img.path!,
                                filename: img.filename
                            })
                        );
                }

                const processedImages = (await Promise.all(newImageBatchPromises)).filter(Boolean) as {
                    path: string;
                    filename: string;
                }[];

                setLatestImageBatch(processedImages);
            } else {
                setLatestImageBatch(null);
                throw new Error('API response did not contain valid image data or filenames.');
            }
        } catch (err: unknown) {
            durationMs = Date.now() - startTime;
            console.error(`API Call Error after ${durationMs}ms:`, err);
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
            setError(errorMessage);
            setLatestImageBatch(null);
        } finally {
            if (durationMs === 0) durationMs = Date.now() - startTime;
            setIsLoading(false);
            // Clean up photo preview
            if (photoPreview) {
                URL.revokeObjectURL(photoPreview);
                setPhotoPreview(null);
            }
        }
    };

    const handleMultiPersonApiCall = async (formData: MultiPersonFormData) => {
        const startTime = Date.now();
        let durationMs = 0;

        setIsLoading(true);
        setError(null);
        setLatestImageBatch(null);

        // Check if user is authenticated
        if (!user) {
            setError('Please sign in to generate images.');
            setIsLoading(false);
            return;
        }

        // Check if user has enough credits (2 credits required for multi-person)
        const REQUIRED_CREDITS = 2;
        if (user.credits < REQUIRED_CREDITS) {
            setError(`You need at least ${REQUIRED_CREDITS} credits for multi-person coloring pages. Please visit your GrooveFunnels account to manage your subscription or start a free trial.`);
            setIsLoading(false);
            return;
        }

        const apiFormData = new FormData();
        if (isPasswordRequiredByBackend && clientPasswordHash) {
            apiFormData.append('passwordHash', clientPasswordHash);
        } else if (isPasswordRequiredByBackend && !clientPasswordHash) {
            setError('Password is required. Please configure the password by clicking the lock icon.');
            setPasswordDialogContext('initial');
            setIsPasswordDialogOpen(true);
            setIsLoading(false);
            return;
        }

        // Add user email for credit checking
        apiFormData.append('userEmail', user.email);

        // Add form data for multi-person API
        apiFormData.append('coloringPageType', formData.coloringPageType);
        apiFormData.append('orientation', formData.orientation);
        if (formData.nameMessage) apiFormData.append('nameMessage', formData.nameMessage);
        if (formData.background) apiFormData.append('background', formData.background);
        if (formData.activityInterest) apiFormData.append('activityInterest', formData.activityInterest);
        if (formData.sceneDescription) apiFormData.append('sceneDescription', formData.sceneDescription);

        // Add individual names for facial portraits
        if (formData.individualNames && formData.individualNames.length > 0) {
            formData.individualNames.forEach((name, index) => {
                if (name.trim()) {
                    apiFormData.append(`individualName_${index}`, name.trim());
                }
            });
        }

        // Add individual activities for cartoon portraits
        if (formData.individualActivities && formData.individualActivities.length > 0) {
            formData.individualActivities.forEach((activity, index) => {
                if (activity.trim()) {
                    apiFormData.append(`individualActivity_${index}`, activity.trim());
                }
            });
        }

        // Add all photos
        formData.photos.forEach((photo, index) => {
            apiFormData.append(`photo_${index}`, photo, photo.name);
        });

        console.log('Sending request to /api/images/replicate with multi-person data');

        try {
            const response = await fetch('/api/images/replicate', {
                method: 'POST',
                body: apiFormData
            });

            const result = await response.json();

            if (!response.ok) {
                if (response.status === 401 && isPasswordRequiredByBackend) {
                    setError('Unauthorized: Invalid or missing password. Please try again.');
                    setPasswordDialogContext('retry');
                    setLastApiCallArgs([formData, 'multi']);
                    setIsPasswordDialogOpen(true);
                    return;
                }
                throw new Error(result.error || `API request failed with status ${response.status}`);
            }

            console.log('Multi-person API Response:', result);

            if (result.images && result.images.length > 0) {
                durationMs = Date.now() - startTime;
                console.log(`Multi-person API call successful. Duration: ${durationMs}ms`);

                // Credits are deducted by the backend API
                // Just refresh to get updated credit count
                refreshCredits();

                let newImageBatchPromises: Promise<{ path: string; filename: string } | null>[] = [];
                if (effectiveStorageModeClient === 'indexeddb') {
                    console.log('Processing multi-person images for IndexedDB storage...');
                    newImageBatchPromises = result.images.map(async (img: ApiImageResponseItem) => {
                        if (img.b64_json) {
                            try {
                                const byteCharacters = atob(img.b64_json);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let i = 0; i < byteCharacters.length; i++) {
                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                }
                                const byteArray = new Uint8Array(byteNumbers);

                                const actualMimeType = getMimeTypeFromFormat(img.output_format);
                                const blob = new Blob([byteArray], { type: actualMimeType });

                                await db.images.put({ filename: img.filename, blob });
                                console.log(`Saved multi-person ${img.filename} to IndexedDB with type ${actualMimeType}.`);

                                const blobUrl = URL.createObjectURL(blob);
                                setBlobUrlCache((prev) => ({ ...prev, [img.filename]: blobUrl }));

                                return { filename: img.filename, path: blobUrl };
                            } catch (dbError) {
                                console.error(`Error saving multi-person blob ${img.filename} to IndexedDB:`, dbError);
                                setError(`Failed to save image ${img.filename} to local database.`);
                                return null;
                            }
                        } else {
                            console.warn(`Multi-person image ${img.filename} missing b64_json in indexeddb mode.`);
                            return null;
                        }
                    });
                } else {
                    newImageBatchPromises = result.images
                        .filter((img: ApiImageResponseItem) => !!img.path)
                        .map((img: ApiImageResponseItem) =>
                            Promise.resolve({
                                path: img.path!,
                                filename: img.filename
                            })
                        );
                }

                const processedImages = (await Promise.all(newImageBatchPromises)).filter(Boolean) as {
                    path: string;
                    filename: string;
                }[];

                setLatestImageBatch(processedImages);
            } else {
                setLatestImageBatch(null);
                throw new Error('Multi-person API response did not contain valid image data or filenames.');
            }
        } catch (err: unknown) {
            durationMs = Date.now() - startTime;
            console.error(`Multi-person API Call Error after ${durationMs}ms:`, err);
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
            setError(errorMessage);
            setLatestImageBatch(null);
        } finally {
            if (durationMs === 0) durationMs = Date.now() - startTime;
            setIsLoading(false);
        }
    };

    return (
        <main className='flex min-h-screen flex-col items-center bg-black p-4 text-white md:p-8 lg:p-12'>
            <PasswordDialog
                isOpen={isPasswordDialogOpen}
                onOpenChange={setIsPasswordDialogOpen}
                onSave={handleSavePassword}
                title={passwordDialogContext === 'retry' ? 'Password Required' : 'Configure Password'}
                description={
                    passwordDialogContext === 'retry'
                        ? 'The server requires a password, or the previous one was incorrect. Please enter it to continue.'
                        : 'Set a password to use for API requests.'
                }
            />
            
            <div className='w-full max-w-7xl space-y-6'>
                <div className='text-center mb-8 relative'>
                    <div className='absolute top-0 right-0'>
                        <AuthDialog />
                    </div>
                    <h1 className='text-3xl font-bold text-white mb-2'>Personalized Coloring Pages</h1>
                    <p className='text-white/60'>Upload a photo to create unique coloring pages</p>
                </div>

                <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
                    <div className='relative flex h-[70vh] min-h-[600px] flex-col lg:col-span-1'>
                        <ColoringForm
                            onSubmit={handleApiCall}
                            onMultiPersonSubmit={handleMultiPersonApiCall}
                            isLoading={isLoading}
                            userCredits={user?.credits || 0}
                            userTier={user?.subscription_tier}
                        />
                    </div>
                    <div className='flex h-[70vh] min-h-[600px] flex-col lg:col-span-1'>
                        {error && (
                            <Alert variant='destructive' className='mb-4 border-red-500/50 bg-red-900/20 text-red-300'>
                                <AlertTitle className='text-red-200'>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <ColoringOutput
                            imageBatch={latestImageBatch}
                            altText='Generated coloring page'
                            isLoading={isLoading}
                            photoPreview={photoPreview}
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}
