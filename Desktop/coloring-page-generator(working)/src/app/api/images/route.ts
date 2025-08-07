import crypto from 'crypto';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import path from 'path';
import sharp from 'sharp';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL
});

const outputDir = path.resolve(process.cwd(), 'generated-images');

// Define valid output formats for type safety
const VALID_OUTPUT_FORMATS = ['png', 'jpeg', 'webp'] as const;
type ValidOutputFormat = (typeof VALID_OUTPUT_FORMATS)[number];

// Validate and normalize output format
function validateOutputFormat(format: unknown): ValidOutputFormat {
    const normalized = String(format || 'png').toLowerCase();

    // Handle jpg -> jpeg normalization
    const mapped = normalized === 'jpg' ? 'jpeg' : normalized;

    if (VALID_OUTPUT_FORMATS.includes(mapped as ValidOutputFormat)) {
        return mapped as ValidOutputFormat;
    }

    return 'png'; // default fallback
}

async function ensureOutputDirExists() {
    try {
        await fs.access(outputDir);
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            try {
                await fs.mkdir(outputDir, { recursive: true });
                console.log(`Created output directory: ${outputDir}`);
            } catch (mkdirError) {
                console.error(`Error creating output directory ${outputDir}:`, mkdirError);
                throw new Error('Failed to create image output directory.');
            }
        } else {
            console.error(`Error accessing output directory ${outputDir}:`, error);
            throw new Error(
                `Failed to access or ensure image output directory exists. Original error: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

export async function POST(request: NextRequest) {
    console.log('Received POST request to /api/images');

    if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY is not set.');
        return NextResponse.json({ error: 'Server configuration error: API key not found.' }, { status: 500 });
    }
    try {
        let effectiveStorageMode: 'fs' | 'indexeddb';
        const explicitMode = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
        const isOnVercel = process.env.VERCEL === '1';

        if (explicitMode === 'fs') {
            effectiveStorageMode = 'fs';
        } else if (explicitMode === 'indexeddb') {
            effectiveStorageMode = 'indexeddb';
        } else if (isOnVercel) {
            effectiveStorageMode = 'indexeddb';
        } else {
            effectiveStorageMode = 'fs';
        }
        console.log(
            `Effective Image Storage Mode: ${effectiveStorageMode} (Explicit: ${explicitMode || 'unset'}, Vercel: ${isOnVercel})`
        );

        if (effectiveStorageMode === 'fs') {
            await ensureOutputDirExists();
        }

        const formData = await request.formData();

        if (process.env.APP_PASSWORD) {
            const clientPasswordHash = formData.get('passwordHash') as string | null;
            if (!clientPasswordHash) {
                console.error('Missing password hash.');
                return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
            }
            const serverPasswordHash = sha256(process.env.APP_PASSWORD);
            if (clientPasswordHash !== serverPasswordHash) {
                console.error('Invalid password hash.');
                return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
            }
        }

        const mode = formData.get('mode') as 'generate' | 'edit' | null;
        const prompt = formData.get('prompt') as string | null;

        console.log(`Mode: ${mode}, Prompt: ${prompt ? prompt.substring(0, 50) + '...' : 'N/A'}`);

        if (!mode || !prompt) {
            return NextResponse.json({ error: 'Missing required parameters: mode and prompt' }, { status: 400 });
        }

        let result: OpenAI.Images.ImagesResponse;
        const generateModel = 'gpt-image-1'; // Use gpt-image-1 for generation
        const editModel = 'dall-e-2'; // Use dall-e-2 for editing (if gpt-image-1 doesn't support editing)

        if (mode === 'generate') {
            const coloringPageType = formData.get('coloringPageType') as 'straight_copy' | 'facial_portrait' | 'cartoon_portrait' | null;
            if (coloringPageType === 'cartoon_portrait') {
                const sceneDescription = formData.get('scene_description') as string | null;
                const sourceImages: File[] = [];
                for (const [key, value] of formData.entries()) {
                    if (key.startsWith('image_') && value instanceof File) {
                        sourceImages.push(value);
                    }
                }

                if (sourceImages.length === 0) {
                    return NextResponse.json({ error: 'No source images provided for cartoon portrait.' }, { status: 400 });
                }

                // Step 1: Isolate subjects using dall-e-2 for editing
                const isolatedSubjects = await Promise.all(sourceImages.map(async (image) => {
                    const response = await openai.images.edit({
                        model: editModel,
                        prompt: 'remove the background and turn this person into a coloring page style character',
                        image: [image],
                        n: 1,
                        size: '1024x1024'
                    });
                    if (!response.data || !response.data[0].b64_json) {
                        throw new Error('Invalid response from OpenAI API when isolating subject');
                    }
                    return Buffer.from(response.data[0].b64_json, 'base64');
                }));

                // Step 2: Generate scene using gpt-image-1
                const sceneResponse = await openai.images.generate({
                    model: generateModel,
                    prompt: sceneDescription || 'a simple, elegant background for a coloring page',
                    n: 1,
                    size: '1024x1024'
                });
                if (!sceneResponse.data || !sceneResponse.data[0].b64_json) {
                    throw new Error('Invalid response from OpenAI API when generating scene');
                }
                const scene = Buffer.from(sceneResponse.data[0].b64_json, 'base64');

                // Step 3: Combine images
                const composite = await sharp(scene)
                    .composite(isolatedSubjects.map(subject => ({ input: subject, gravity: 'center' })))
                    .toBuffer();

                // Step 4: Convert to coloring page (already done in step 1)
                // For now, just return the composite image
                const timestamp = Date.now();
                const fileExtension = validateOutputFormat(formData.get('output_format'));
                const filename = `${timestamp}-composite.${fileExtension}`;

                const imageResult: { filename: string; b64_json: string; path?: string; output_format: string } = {
                    filename: filename,
                    b64_json: composite.toString('base64'),
                    output_format: fileExtension
                };

                if (effectiveStorageMode === 'fs') {
                    const filepath = path.join(outputDir, filename);
                    await fs.writeFile(filepath, composite);
                    imageResult.path = `/api/image/${filename}`;
                }

                return NextResponse.json({ images: [imageResult] });

            } else {
                // Handle single image coloring page requests
                const imageFile = formData.get('image_0') as File | null;
                
                if (imageFile) {
                    // This is a coloring page generation request - use the edit endpoint with the photo
                    const n = parseInt((formData.get('n') as string) || '1', 10);
                    const size = '1024x1024';
                    const quality = (formData.get('quality') as OpenAI.Images.ImageEditParams['quality']) || 'high';

                    const params: OpenAI.Images.ImageEditParams = {
                        model: editModel, // Use dall-e-2 for editing
                        prompt,
                        image: [imageFile],
                        n: Math.max(1, Math.min(n || 1, 10)),
                        size: size,
                        quality: quality === 'auto' ? undefined : quality
                    };

                    console.log('Calling OpenAI edit with coloring page params:', {
                        ...params,
                        image: `[${imageFile.name}]`
                    });
                    result = await openai.images.edit(params);
                } else {
                    // This case should not be reached for coloring pages
                    return NextResponse.json({ error: 'No image provided for coloring page generation.' }, { status: 400 });
                }
            }
        } else if (mode === 'edit') {
            const n = parseInt((formData.get('n') as string) || '1', 10);
            const size = (formData.get('size') as OpenAI.Images.ImageEditParams['size']) || 'auto';
            const quality = (formData.get('quality') as OpenAI.Images.ImageEditParams['quality']) || 'auto';

            const imageFiles: File[] = [];
            for (const [key, value] of formData.entries()) {
                if (key.startsWith('image_') && value instanceof File) {
                    imageFiles.push(value);
                }
            }

            if (imageFiles.length === 0) {
                return NextResponse.json({ error: 'No image file provided for editing.' }, { status: 400 });
            }

            const maskFile = formData.get('mask') as File | null;

            const params: OpenAI.Images.ImageEditParams = {
                model: editModel, // Use dall-e-2 for editing
                prompt,
                image: imageFiles,
                n: Math.max(1, Math.min(n || 1, 10)),
                size: size === 'auto' ? undefined : size,
                quality: quality === 'auto' ? undefined : quality
            };

            if (maskFile) {
                params.mask = maskFile;
            }

            console.log('Calling OpenAI edit with params:', {
                ...params,
                image: `[${imageFiles.map((f) => f.name).join(', ')}]`,
                mask: maskFile ? maskFile.name : 'N/A'
            });
            result = await openai.images.edit(params);
        } else {
            return NextResponse.json({ error: 'Invalid mode specified' }, { status: 400 });
        }

        console.log('OpenAI API call successful.');

        if (!result || !Array.isArray(result.data) || result.data.length === 0) {
            console.error('Invalid or empty data received from OpenAI API:', result);
            return NextResponse.json({ error: 'Failed to retrieve image data from API.' }, { status: 500 });
        }

        const savedImagesData = await Promise.all(
            result.data.map(async (imageData, index) => {
                if (!imageData.b64_json) {
                    console.error(`Image data ${index} is missing b64_json.`);
                    throw new Error(`Image data at index ${index} is missing base64 data.`);
                }
                const buffer = Buffer.from(imageData.b64_json, 'base64');
                const timestamp = Date.now();

                const fileExtension = validateOutputFormat(formData.get('output_format'));
                const filename = `${timestamp}-${index}.${fileExtension}`;

                if (effectiveStorageMode === 'fs') {
                    const filepath = path.join(outputDir, filename);
                    console.log(`Attempting to save image to: ${filepath}`);
                    await fs.writeFile(filepath, buffer);
                    console.log(`Successfully saved image: ${filename}`);
                } else {
                }

                const imageResult: { filename: string; b64_json: string; path?: string; output_format: string } = {
                    filename: filename,
                    b64_json: imageData.b64_json,
                    output_format: fileExtension
                };

                if (effectiveStorageMode === 'fs') {
                    imageResult.path = `/api/image/${filename}`;
                }

                return imageResult;
            })
        );

        console.log(`All images processed. Mode: ${effectiveStorageMode}`);

        return NextResponse.json({ images: savedImagesData, usage: result.usage });
    } catch (error: unknown) {
        console.error('Error in /api/images:', error);

        let errorMessage = 'An unexpected error occurred.';
        let status = 500;

        if (error instanceof Error) {
            errorMessage = error.message;
            if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
                status = error.status;
            }
        } else if (typeof error === 'object' && error !== null) {
            if ('message' in error && typeof error.message === 'string') {
                errorMessage = error.message;
            }
            if ('status' in error && typeof error.status === 'number') {
                status = error.status;
            }
        }

        return NextResponse.json({ error: errorMessage }, { status });
    }
}
