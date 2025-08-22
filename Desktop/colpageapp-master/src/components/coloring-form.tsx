'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, User, Palette, Activity, Upload, X, Users, Lock } from 'lucide-react';
import * as React from 'react';

export type ColoringFormData = {
    photo?: File;
    photos?: File[];
    coloringPageType: 'straight_copy' | 'facial_portrait' | 'cartoon_portrait';
    nameMessage?: string;
    background?: 'plain' | 'mindful';
    activityInterest?: string;
    sceneDescription?: string;
    personCount: 'single' | 'multiple';
    orientation: 'portrait' | 'landscape';
};

export type MultiPersonFormData = {
    photos: File[];
    coloringPageType: 'facial_portrait' | 'cartoon_portrait';
    nameMessage?: string; // Family name
    background?: 'plain' | 'mindful';
    activityInterest?: string;
    sceneDescription?: string;
    orientation: 'portrait' | 'landscape';
    individualNames?: string[]; // Individual names for each person (facial portrait only)
    individualActivities?: string[]; // Individual activities for each person (cartoon portrait only)
};

type ColoringFormProps = {
    onSubmit: (data: ColoringFormData) => void;
    onMultiPersonSubmit: (data: MultiPersonFormData) => void;
    isLoading: boolean;
    userCredits: number;
    userTier?: 'basic' | 'standard' | 'premium' | null;
};

const generatePrompt = (data: ColoringFormData): string => {
    const { coloringPageType, nameMessage, background, activityInterest } = data;
    
    // Helper to replace placeholder with actual value or empty string
    const replaceName = (prompt: string) => nameMessage ? prompt.replace('[NAME]', nameMessage) : prompt;
    const replaceActivity = (prompt: string) => activityInterest ? prompt.replace('[ACTIVITY]', activityInterest) : prompt;

    if (coloringPageType === 'straight_copy') {
        if (!nameMessage) {
            return 'turn the attached photo into a line drawing suitable for a coloring page, ensuring accurate facial features are maintained. place the result, as large as possible whilst still looking elegant, centered vertically and horizontally on a plain white background';
        } else {
            return replaceName('turn the attached photo into a line drawing suitable for a coloring page, ensuring accurate facial features are maintained. write [NAME] in friendly white letters with black outline, suited to a coloring page. place the writing unobtrusively on top of the line drawing, ensuring it doesn\'t obscure the subject\'s face. finally center the whole thing, as large as possible whilst still looking elegant, on a plain white background.');
        }
    }

    if (coloringPageType === 'facial_portrait') {
        const isPlain = background === 'plain';
        const hasName = !!nameMessage;
        
        if (!hasName && isPlain) {
            return 'turn the face from the attached photo into a line drawing suitable for a coloring page, ensuring accurate facial features are maintained. place the result, as large as possible whilst still looking elegant, inside a plain white box with a black outline. center this horizontally and vertically on a plain white background';
        } else if (hasName && isPlain) {
            return replaceName('turn the face from the attached photo into a line drawing suitable for a coloring page, ensuring accurate facial features are maintained. place the result, as large as possible whilst still looking elegant, inside a plain white box with a black outline. below this box write [NAME] in friendly white letters with black outline, suited to a coloring page. center this collection of objects horizontally and vertically on a plain white background');
        } else if (!hasName && !isPlain) {
            return 'turn the face from the attached photo into a line drawing suitable for a coloring page, ensuring accurate facial features are maintained. place the result, as large as possible whilst still looking elegant, inside a plain white box with a black outline. center this horizontally and vertically on top of an abstract pattern suitable for mindful coloring';
        } else {
            return replaceName('turn the face from the attached photo into a line drawing suitable for a coloring page, ensuring accurate facial features are maintained. place the result, as large as possible whilst still looking elegant, inside a plain white box with a black outline. below this box write [NAME] in friendly white letters with black outline, suited to a coloring page. center this collection of objects horizontally and vertically on top of an abstract pattern suitable for mindful coloring');
        }
    }

    if (coloringPageType === 'cartoon_portrait') {
        const isPlain = background === 'plain';
        const hasName = !!nameMessage;
        const hasActivity = !!activityInterest;
        
        if (!hasName && isPlain && !hasActivity) {
            return 'turn the face from the attached photo into a line drawing suitable for a coloring page, ensuring accurate facial features are maintained. place the result onto a cartoon style line drawing body in the same coloring page style. place this result as large as possible whilst still looking elegant, centered horizontally and vertically on a plain white background';
        } else if (hasName && isPlain && !hasActivity) {
            return replaceName('turn the face from the attached photo into a line drawing suitable for a coloring page, ensuring accurate facial features are maintained. place the result onto a cartoon style line drawing body in the same coloring page style. below this write [NAME] in friendly white letters with black outline, suited to a coloring page. finally place this collection of objects as large as possible whilst still looking elegant, centered horizontally and vertically on a plain white background');
        } else if (!hasName && isPlain && hasActivity) {
            return replaceActivity('turn the face from the attached photo into a line drawing suitable for a coloring page, ensuring accurate facial features are maintained. place the result onto a cartoon style line drawing body in the same coloring page style engaged in [ACTIVITY]. place this result as large as possible whilst still looking elegant, centered horizontally and vertically on a plain white background');
        } else if (hasName && isPlain && hasActivity) {
            return replaceActivity(replaceName('turn the face from the attached photo into a line drawing suitable for a coloring page, ensuring accurate facial features are maintained. place the result onto a cartoon style line drawing body in the same coloring page style engaged in [ACTIVITY]. below this write [NAME] in friendly white letters with black outline, suited to a coloring page. finally place this collection of objects as large as possible whilst still looking elegant, centered horizontally and vertically on a plain white background'));
        } else if (!hasName && !isPlain && !hasActivity) {
            return 'turn the face from the attached photo into a line drawing suitable for a coloring page, ensuring accurate facial features are maintained. place the result onto a cartoon style line drawing body in the same coloring page style. place this result as large as possible whilst still looking elegant, centered horizontally and vertically on top of an abstract pattern suitable for mindful coloring';
        } else if (hasName && !isPlain && !hasActivity) {
            return replaceName('turn the face from the attached photo into a line drawing suitable for a coloring page, ensuring accurate facial features are maintained. place the result onto a cartoon style line drawing body in the same coloring page style. below this write [NAME] in friendly white letters with black outline, suited to a coloring page. finally place this collection of objects as large as possible whilst still looking elegant, centered horizontally and vertically on top of an abstract pattern suitable for mindful coloring');
        } else if (!hasName && !isPlain && hasActivity) {
            return replaceActivity('turn the face from the attached photo into a line drawing suitable for a coloring page, ensuring accurate facial features are maintained. place the result onto a cartoon style line drawing body in the same coloring page style engaged in [ACTIVITY]. place this result as large as possible whilst still looking elegant, centered horizontally and vertically on top of an abstract pattern suitable for mindful coloring');
        } else {
            return replaceActivity(replaceName('turn the face from the attached photo into a line drawing suitable for a coloring page, ensuring accurate facial features are maintained. place the result onto a cartoon style line drawing body in the same coloring page style engaged in [ACTIVITY]. below this write [NAME] in friendly white letters with black outline, suited to a coloring page. finally place this collection of objects as large as possible whilst still looking elegant, centered horizontally and vertically on top of an abstract pattern suitable for mindful coloring'));
        }
    }

    return '';
};

export function ColoringForm({ onSubmit, onMultiPersonSubmit, isLoading, userCredits, userTier }: ColoringFormProps) {
    const [personCount, setPersonCount] = React.useState<'single' | 'multiple'>('single');
    const [photo, setPhoto] = React.useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
    const [photos, setPhotos] = React.useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = React.useState<string[]>([]);
    const [coloringPageType, setColoringPageType] = React.useState<ColoringFormData['coloringPageType']>('straight_copy');
    const [nameMessage, setNameMessage] = React.useState('');
    const [background, setBackground] = React.useState<'plain' | 'mindful'>('plain');
    const [activityInterest, setActivityInterest] = React.useState('');
    const [sceneDescription, setSceneDescription] = React.useState('');
    const [orientation, setOrientation] = React.useState<'portrait' | 'landscape'>('portrait');
    const [individualNames, setIndividualNames] = React.useState<string[]>([]);
    const [individualActivities, setIndividualActivities] = React.useState<string[]>([]);

    const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setPhoto(file);
            const previewUrl = URL.createObjectURL(file);
            setPhotoPreview(previewUrl);
        }
    };

    const handleMultiplePhotosChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const files = Array.from(event.target.files);
            setPhotos(prev => [...prev, ...files]);
            const newPreviews = files.map(file => URL.createObjectURL(file));
            setPhotoPreviews(prev => [...prev, ...newPreviews]);
        }
    };

    const removePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
        setPhotoPreviews(prev => {
            const newPreviews = prev.filter((_, i) => i !== index);
            URL.revokeObjectURL(prev[index]);
            return newPreviews;
        });
        // Also remove corresponding individual name and activity
        setIndividualNames(prev => prev.filter((_, i) => i !== index));
        setIndividualActivities(prev => prev.filter((_, i) => i !== index));
    };

    // Update individual names array when photos change
    React.useEffect(() => {
        if (personCount === 'multiple' && coloringPageType === 'facial_portrait') {
            setIndividualNames(prev => {
                const newNames = [...prev];
                // Ensure array has same length as photos
                while (newNames.length < photos.length) {
                    newNames.push('');
                }
                while (newNames.length > photos.length) {
                    newNames.pop();
                }
                return newNames;
            });
        }
        if (personCount === 'multiple' && coloringPageType === 'cartoon_portrait') {
            setIndividualActivities(prev => {
                const newActivities = [...prev];
                // Ensure array has same length as photos
                while (newActivities.length < photos.length) {
                    newActivities.push('');
                }
                while (newActivities.length > photos.length) {
                    newActivities.pop();
                }
                return newActivities;
            });
        }
    }, [photos.length, personCount, coloringPageType]);

    const updateIndividualName = (index: number, name: string) => {
        setIndividualNames(prev => {
            const newNames = [...prev];
            newNames[index] = name;
            return newNames;
        });
    };

    const updateIndividualActivity = (index: number, activity: string) => {
        setIndividualActivities(prev => {
            const newActivities = [...prev];
            newActivities[index] = activity;
            return newActivities;
        });
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        
        if (personCount === 'multiple') {
            if (photos.length === 0) return;

            const multiFormData: MultiPersonFormData = {
                photos,
                coloringPageType: coloringPageType as 'facial_portrait' | 'cartoon_portrait',
                nameMessage: nameMessage.trim() || undefined,
                background: background,
                activityInterest: coloringPageType === 'cartoon_portrait' && activityInterest.trim() ? activityInterest.trim() : undefined,
                sceneDescription: coloringPageType === 'cartoon_portrait' ? (sceneDescription.trim() || undefined) : undefined,
                orientation: orientation,
                individualNames: coloringPageType === 'facial_portrait' ? individualNames.filter(name => name.trim() !== '') : undefined,
                individualActivities: coloringPageType === 'cartoon_portrait' ? individualActivities.filter(activity => activity.trim() !== '') : undefined
            };

            onMultiPersonSubmit(multiFormData);
        } else {
            if (!photo) return;

            const formData: ColoringFormData = {
                photo,
                coloringPageType,
                nameMessage: nameMessage.trim() || undefined,
                background: coloringPageType !== 'straight_copy' ? background : undefined,
                activityInterest: coloringPageType === 'cartoon_portrait' && activityInterest.trim() ? activityInterest.trim() : undefined,
                personCount,
                orientation: orientation
            };

            onSubmit(formData);
        }
    };

    React.useEffect(() => {
        return () => {
            if (photoPreview) {
                URL.revokeObjectURL(photoPreview);
            }
            photoPreviews.forEach(url => URL.revokeObjectURL(url));
        };
    }, [photoPreview, photoPreviews]);

    // Check if user can access multiple photos feature (basic tier cannot)
    const canAccessMultiplePhotos = userTier !== 'basic';
    
    const showBackgroundOption = personCount === 'single' ? coloringPageType !== 'straight_copy' : true;
    const showActivityOption = coloringPageType === 'cartoon_portrait';
    const requiredCredits = personCount === 'single' ? 1 : 2;
    const canSubmit = personCount === 'single' 
        ? (photo && userCredits >= requiredCredits && !isLoading)
        : (photos.length > 0 && userCredits >= requiredCredits && !isLoading && canAccessMultiplePhotos);

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='border-b border-white/10 pb-4'>
                <div className='flex items-center justify-between'>
                    <div>
                        <CardTitle className='text-lg font-medium text-white'>Create Coloring Page</CardTitle>
                        <CardDescription className='mt-1 text-white/60'>
                            Upload a photo to create a personalized coloring page
                        </CardDescription>
                    </div>
                    <div className='text-right'>
                        <div className='text-sm text-white/60'>Credits</div>
                        <div className='text-xl font-bold text-white'>{userCredits}</div>
                    </div>
                </div>
            </CardHeader>
            <form onSubmit={handleSubmit} className='flex h-full flex-1 flex-col overflow-hidden'>
                <CardContent className='flex-1 space-y-5 overflow-y-auto p-4'>
                    {/* Generation Time Warning */}
                    <div className='rounded-md border border-yellow-500/50 bg-yellow-900/20 p-3'>
                        <div className='flex items-start gap-2'>
                            <div className='mt-0.5 h-4 w-4 shrink-0 rounded-full bg-yellow-500/20 flex items-center justify-center'>
                                <div className='h-2 w-2 rounded-full bg-yellow-500'></div>
                            </div>
                            <div>
                                <p className='text-sm font-medium text-yellow-200 mb-1'>
                                    ⏱️ Coloring pages take 2-3 minutes to generate
                                </p>
                                <p className='text-xs text-yellow-300/80'>
                                    Please be patient after clicking "Create Coloring Page" - the system is working on your request!
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Person Count Selection */}
                    <div className='space-y-3'>
                        <Label className='flex items-center gap-2 text-white'>
                            <Users className='h-4 w-4' />
                            Number of People
                        </Label>
                        <RadioGroup
                            value={personCount}
                            onValueChange={(value) => setPersonCount(value as 'single' | 'multiple')}
                            disabled={isLoading}
                            className='space-y-3'>
                            <div className='flex items-center justify-between rounded-md border border-white/20 p-3'>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='single'
                                        id='single-person'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='single-person' className='cursor-pointer text-white/80'>
                                        Single Person
                                    </Label>
                                </div>
                                <div className='text-sm text-white/60'>1 credit</div>
                            </div>
                            <div className={`flex items-center justify-between rounded-md border p-3 ${
                                canAccessMultiplePhotos 
                                    ? 'border-white/20' 
                                    : 'border-red-500/50 bg-red-900/10'
                            }`}>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='multiple'
                                        id='multiple-people'
                                        disabled={!canAccessMultiplePhotos}
                                        className={`border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white ${
                                            !canAccessMultiplePhotos ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                    />
                                    <div className='flex items-center gap-2'>
                                        <Label htmlFor='multiple-people' className={`cursor-pointer text-white/80 ${
                                            !canAccessMultiplePhotos ? 'opacity-50' : ''
                                        }`}>
                                            Multiple People
                                        </Label>
                                        {!canAccessMultiplePhotos && <Lock className='h-4 w-4 text-red-400' />}
                                    </div>
                                </div>
                                <div className='text-sm text-white/60'>2 credits</div>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Single Photo Upload */}
                    {personCount === 'single' && (
                        <div className='space-y-2'>
                            <Label htmlFor='photo' className='text-white'>
                                Upload Photo
                            </Label>
                            <div className='flex items-center gap-4'>
                                <Input
                                    id='photo'
                                    type='file'
                                    accept='image/*'
                                    onChange={handlePhotoChange}
                                    disabled={isLoading}
                                    className='rounded-md border border-white/20 bg-black text-white file:border-0 file:bg-white/10 file:text-white focus:border-white/50'
                                />
                                {photoPreview && (
                                    <div className='h-16 w-16 overflow-hidden rounded border border-white/20'>
                                        <img
                                            src={photoPreview}
                                            alt='Photo preview'
                                            className='h-full w-full object-cover'
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Multiple Photos Upload */}
                    {personCount === 'multiple' && (
                        <div className='space-y-3 rounded-md border border-white/20 bg-black/20 p-4'>
                            <h3 className='text-md font-semibold text-white'>Multiple People</h3>
                            <div className='space-y-2'>
                                <Label className='text-white'>Upload Photos of People</Label>
                                <div className='grid grid-cols-3 gap-2'>
                                    {photoPreviews.map((previewUrl, index) => (
                                        <div key={index} className='relative'>
                                            <img
                                                src={previewUrl}
                                                alt={`Photo ${index + 1}`}
                                                className='h-24 w-24 rounded-md object-cover'
                                            />
                                            <div className='absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white'>
                                                {index + 1}
                                            </div>
                                            <Button
                                                type='button'
                                                variant='destructive'
                                                size='icon'
                                                className='absolute right-1 top-1 h-6 w-6'
                                                onClick={() => removePhoto(index)}
                                                disabled={isLoading}>
                                                <X className='h-4 w-4' />
                                            </Button>
                                        </div>
                                    ))}
                                    <Label
                                        htmlFor='multiple-photos-upload'
                                        className='flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-white/30 bg-black/20 text-white/60 hover:border-white/50 hover:text-white'>
                                        <Upload className='h-8 w-8' />
                                        <span className='text-xs'>Upload</span>
                                    </Label>
                                </div>
                                <input
                                    id='multiple-photos-upload'
                                    type='file'
                                    multiple
                                    accept='image/*'
                                    onChange={handleMultiplePhotosChange}
                                    className='hidden'
                                    disabled={isLoading}
                                />
                            </div>
                            {/* Scene Description - only for cartoon portraits */}
                            {coloringPageType === 'cartoon_portrait' && (
                                <div className='space-y-1.5'>
                                    <Label htmlFor='scene-description' className='text-white'>
                                        Scene Description (Optional)
                                    </Label>
                                    <Textarea
                                        id='scene-description'
                                        placeholder='e.g., standing in a field of dandelions'
                                        value={sceneDescription}
                                        onChange={(e) => setSceneDescription(e.target.value)}
                                        disabled={isLoading}
                                        rows={2}
                                        className='min-h-[60px] rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                    />
                                </div>
                            )}

                            {/* Individual Names - only for facial portraits */}
                            {coloringPageType === 'facial_portrait' && photos.length > 0 && (
                                <div className='space-y-3'>
                                    <Label className='flex items-center gap-2 text-white'>
                                        <User className='h-4 w-4' />
                                        Individual Names (Optional)
                                    </Label>
                                    <div className='space-y-2'>
                                        {photos.map((_, index) => (
                                            <div key={index} className='space-y-1'>
                                                <Label className='text-sm text-white/80'>
                                                    Name for Photo {index + 1}
                                                </Label>
                                                <Input
                                                    type='text'
                                                    placeholder={`Name for person ${index + 1}`}
                                                    value={individualNames[index] || ''}
                                                    onChange={(e) => updateIndividualName(index, e.target.value)}
                                                    disabled={isLoading}
                                                    className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50'
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Individual Activities - only for cartoon portraits */}
                            {coloringPageType === 'cartoon_portrait' && photos.length > 0 && (
                                <div className='space-y-3'>
                                    <Label className='flex items-center gap-2 text-white'>
                                        <Activity className='h-4 w-4' />
                                        Individual Activities (Optional)
                                    </Label>
                                    <div className='space-y-2'>
                                        {photos.map((_, index) => (
                                            <div key={index} className='space-y-1'>
                                                <Label className='text-sm text-white/80'>
                                                    Activity for Photo {index + 1}
                                                </Label>
                                                <Input
                                                    type='text'
                                                    placeholder={`e.g., playing guitar, reading, gardening`}
                                                    value={individualActivities[index] || ''}
                                                    onChange={(e) => updateIndividualActivity(index, e.target.value)}
                                                    disabled={isLoading}
                                                    className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50'
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Coloring Page Type */}
                    <div className='space-y-3'>
                        <Label className='block text-white'>Coloring Page Type</Label>
                        <Select
                            value={coloringPageType}
                            onValueChange={(value) => setColoringPageType(value as ColoringFormData['coloringPageType'])}
                            disabled={isLoading}>
                            <SelectTrigger className='rounded-md border border-white/20 bg-black text-white focus:border-white/50'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className='border border-white/20 bg-black text-white'>
                                {personCount === 'single' && <SelectItem value='straight_copy'>Straight copy of photo</SelectItem>}
                                <SelectItem value='facial_portrait'>Facial portrait</SelectItem>
                                <SelectItem value='cartoon_portrait'>Cartoon portrait</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Name/Short Message */}
                    <div className='space-y-2'>
                        <Label htmlFor='name-message' className='flex items-center gap-2 text-white'>
                            <User className='h-4 w-4' />
                            Name/Short Message (Optional)
                        </Label>
                        <Input
                            id='name-message'
                            type='text'
                            placeholder='e.g., Sarah, Happy Birthday, etc.'
                            value={nameMessage}
                            onChange={(e) => setNameMessage(e.target.value)}
                            disabled={isLoading}
                            className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50'
                        />
                    </div>

                    {/* Background (conditional) */}
                    {showBackgroundOption && (
                        <div className='space-y-3'>
                            <Label className='flex items-center gap-2 text-white'>
                                <Palette className='h-4 w-4' />
                                Background
                            </Label>
                            <RadioGroup
                                value={background}
                                onValueChange={(value) => setBackground(value as 'plain' | 'mindful')}
                                disabled={isLoading}
                                className='flex gap-6'>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='plain'
                                        id='bg-plain'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='bg-plain' className='cursor-pointer text-white/80'>
                                        Plain
                                    </Label>
                                </div>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='mindful'
                                        id='bg-mindful'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='bg-mindful' className='cursor-pointer text-white/80'>
                                        Mindful coloring
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                    )}

                    {/* Activity/Interest (conditional) - hide when using individual activities */}
                    {showActivityOption && !(personCount === 'multiple' && photos.length > 0) && (
                        <div className='space-y-2'>
                            <Label htmlFor='activity' className='flex items-center gap-2 text-white'>
                                <Activity className='h-4 w-4' />
                                Activity/Interest (Optional)
                            </Label>
                            <Textarea
                                id='activity'
                                placeholder='e.g., playing football, reading books, dancing, etc.'
                                value={activityInterest}
                                onChange={(e) => setActivityInterest(e.target.value)}
                                disabled={isLoading}
                                rows={2}
                                className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50'
                            />
                        </div>
                    )}

                    {/* Orientation Selection */}
                    <div className='space-y-3'>
                        <Label className='flex items-center gap-2 text-white'>
                            <Palette className='h-4 w-4' />
                            Page Orientation
                        </Label>
                        <RadioGroup
                            value={orientation}
                            onValueChange={(value) => setOrientation(value as 'portrait' | 'landscape')}
                            disabled={isLoading}
                            className='flex gap-6'>
                            <div className='flex items-center space-x-2'>
                                <RadioGroupItem
                                    value='portrait'
                                    id='orientation-portrait'
                                    className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                />
                                <Label htmlFor='orientation-portrait' className='cursor-pointer text-white/80'>
                                    Portrait (Tall)
                                </Label>
                            </div>
                            <div className='flex items-center space-x-2'>
                                <RadioGroupItem
                                    value='landscape'
                                    id='orientation-landscape'
                                    className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                />
                                <Label htmlFor='orientation-landscape' className='cursor-pointer text-white/80'>
                                    Landscape (Wide)
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {!canAccessMultiplePhotos && personCount === 'multiple' && (
                        <div className='rounded-md border border-blue-500/50 bg-blue-900/20 p-3'>
                            <p className='text-blue-300 mb-2'>
                                <strong>Upgrade Required:</strong> Multiple photo coloring pages are available with Standard ($24.95/month) or Premium ($49.95/month) plans.
                            </p>
                            <p className='text-blue-300'>
                                <a
                                    href='https://FarawayGrandparents.com/colorpages-packages'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='underline hover:text-blue-200'>
                                    Upgrade your subscription
                                </a>{' '}
                                to unlock this feature.
                            </p>
                        </div>
                    )}

                    {userCredits === 0 && (
                        <div className='rounded-md border border-yellow-500/50 bg-yellow-900/20 p-3'>
                            <p className='text-yellow-300'>
                                You have no credits remaining.{' '}
                                <a
                                    href='https://FarawayGrandparents.com/colorpages-packages'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='underline hover:text-yellow-200'>
                                    Purchase more credits
                                </a>{' '}
                                to continue creating coloring pages.
                            </p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className='border-t border-white/10 p-4'>
                    <Button
                        type='submit'
                        disabled={!canSubmit}
                        className='flex w-full items-center justify-center gap-2 rounded-md bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40'>
                        {isLoading && <Loader2 className='h-4 w-4 animate-spin' />}
                        {isLoading ? 'Creating Coloring Page...' : 'Create Coloring Page'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}

export { generatePrompt };
