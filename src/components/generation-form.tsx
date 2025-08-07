'use client';

import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
    Square,
    RectangleHorizontal,
    RectangleVertical,
    Sparkles,
    Eraser,
    ShieldCheck,
    ShieldAlert,
    FileImage,
    Tally1,
    Tally2,
    Tally3,
    Loader2,
    BrickWall,
    Lock,
    LockOpen,
    Upload,
    X
} from 'lucide-react';
import * as React from 'react';

export type GenerationFormData = {
    prompt: string;
    scene_description?: string;
    source_images?: File[];
    n: number;
    size: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
    quality: 'low' | 'medium' | 'high' | 'auto';
    output_format: 'png' | 'jpeg' | 'webp';
    output_compression?: number;
    background: 'transparent' | 'opaque' | 'auto';
    moderation: 'low' | 'auto';
    style: 'cartoon' | 'photorealistic' | 'auto';
};

type GenerationFormProps = {
    onSubmit: (data: GenerationFormData) => void;
    isLoading: boolean;
    currentMode: 'generate' | 'edit';
    onModeChange: (mode: 'generate' | 'edit') => void;
    isPasswordRequiredByBackend: boolean | null;
    clientPasswordHash: string | null;
    onOpenPasswordDialog: () => void;
    prompt: string;
    setPrompt: React.Dispatch<React.SetStateAction<string>>;
    n: number[];
    setN: React.Dispatch<React.SetStateAction<number[]>>;
    size: GenerationFormData['size'];
    setSize: React.Dispatch<React.SetStateAction<GenerationFormData['size']>>;
    quality: GenerationFormData['quality'];
    setQuality: React.Dispatch<React.SetStateAction<GenerationFormData['quality']>>;
    outputFormat: GenerationFormData['output_format'];
    setOutputFormat: React.Dispatch<React.SetStateAction<GenerationFormData['output_format']>>;
    compression: number[];
    setCompression: React.Dispatch<React.SetStateAction<number[]>>;
    background: GenerationFormData['background'];
    setBackground: React.Dispatch<React.SetStateAction<GenerationFormData['background']>>;
    moderation: GenerationFormData['moderation'];
    setModeration: React.Dispatch<React.SetStateAction<GenerationFormData['moderation']>>;
    style: GenerationFormData['style'];
    setStyle: React.Dispatch<React.SetStateAction<GenerationFormData['style']>>;
};

const RadioItemWithIcon = ({
    value,
    id,
    label,
    Icon
}: {
    value: string;
    id: string;
    label: string;
    Icon: React.ElementType;
}) => (
    <div className='flex items-center space-x-2'>
        <RadioGroupItem
            value={value}
            id={id}
            className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
        />
        <Label htmlFor={id} className='flex cursor-pointer items-center gap-2 text-base text-white/80'>
            <Icon className='h-5 w-5 text-white/60' />
            {label}
        </Label>
    </div>
);

export function GenerationForm({
    onSubmit,
    isLoading,
    currentMode,
    onModeChange,
    isPasswordRequiredByBackend,
    clientPasswordHash,
    onOpenPasswordDialog,
    prompt,
    setPrompt,
    n,
    setN,
    size,
    setSize,
    quality,
    setQuality,
    outputFormat,
    setOutputFormat,
    compression,
    setCompression,
    background,
    setBackground,
    moderation,
    setModeration,
    style,
    setStyle
}: GenerationFormProps) {
    const [sourceImages, setSourceImages] = React.useState<File[]>([]);
    const [sceneDescription, setSceneDescription] = React.useState('');
    const showCompression = outputFormat === 'jpeg' || outputFormat === 'webp';
    const isCartoonStyle = style === 'cartoon';

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setSourceImages(prev => [...prev, ...Array.from(event.target.files as FileList)]);
        }
    };

    const removeImage = (index: number) => {
        setSourceImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData: GenerationFormData = {
            prompt,
            n: n[0],
            size,
            quality,
            output_format: outputFormat,
            background,
            moderation,
            style
        };
        if (isCartoonStyle) {
            formData.scene_description = sceneDescription;
            formData.source_images = sourceImages;
        }
        if (showCompression) {
            formData.output_compression = compression[0];
        }
        onSubmit(formData);
    };

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex items-start justify-between border-b border-white/10 pb-4'>
                <div>
                    <div className='flex items-center'>
                        <CardTitle className='py-1 text-lg font-medium text-white'>Generate Image</CardTitle>
                        {isPasswordRequiredByBackend && (
                            <Button
                                variant='ghost'
                                size='icon'
                                onClick={onOpenPasswordDialog}
                                className='ml-2 text-white/60 hover:text-white'
                                aria-label='Configure Password'>
                                {clientPasswordHash ? <Lock className='h-4 w-4' /> : <LockOpen className='h-4 w-4' />}
                            </Button>
                        )}
                    </div>
                    <CardDescription className='mt-1 text-white/60'>
                        Create a new image from a text prompt using gpt-image-1.
                    </CardDescription>
                </div>
                <ModeToggle currentMode={currentMode} onModeChange={onModeChange} />
            </CardHeader>
            <form onSubmit={handleSubmit} className='flex h-full flex-1 flex-col overflow-hidden'>
                <CardContent className='flex-1 space-y-5 overflow-y-auto p-4'>
                    {isLoading && (
                        <div className='rounded-md border border-yellow-400/50 bg-yellow-900/20 p-3 text-center text-sm text-yellow-200'>
                            <p>Please allow 2-3 minutes for your coloring page to generate.</p>
                            <p className='mt-1 text-yellow-200/70'>Feel free to close this window - your image will appear in the history panel when it&apos;s ready.</p>
                        </div>
                    )}
                    <div className='space-y-1.5'>
                        <Label htmlFor='prompt' className='text-white'>
                            Prompt
                        </Label>
                        <Textarea
                            id='prompt'
                            placeholder='e.g., A photorealistic cat astronaut floating in space'
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            required
                            disabled={isLoading}
                            className='min-h-[80px] rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                        />
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>Style</Label>
                        <RadioGroup
                            value={style}
                            onValueChange={(value) => setStyle(value as GenerationFormData['style'])}
                            disabled={isLoading}
                            className='flex flex-wrap gap-x-5 gap-y-3'>
                            <RadioItemWithIcon value='auto' id='style-auto' label='Auto' Icon={Sparkles} />
                            <RadioItemWithIcon value='photorealistic' id='style-photorealistic' label='Photorealistic' Icon={FileImage} />
                            <RadioItemWithIcon value='cartoon' id='style-cartoon' label='Cartoon Portrait' Icon={Eraser} />
                        </RadioGroup>
                    </div>

                    {isCartoonStyle && (
                        <div className='space-y-3 rounded-md border border-white/20 bg-black/20 p-4'>
                            <h3 className='text-md font-semibold text-white'>Cartoon Portrait Scene</h3>
                            <div className='space-y-1.5'>
                                <Label htmlFor='scene-description' className='text-white'>
                                    Scene Description
                                </Label>
                                <Textarea
                                    id='scene-description'
                                    placeholder='e.g., in a field full of dandelions with ducks'
                                    value={sceneDescription}
                                    onChange={(e) => setSceneDescription(e.target.value)}
                                    disabled={isLoading}
                                    className='min-h-[60px] rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                />
                            </div>
                            <div className='space-y-2'>
                                <Label className='text-white'>Source Images</Label>
                                <div className='grid grid-cols-3 gap-2'>
                                    {sourceImages.map((file, index) => (
                                        <div key={index} className='relative'>
                                            <img
                                                src={URL.createObjectURL(file)}
                                                alt={`Source image ${index + 1}`}
                                                className='h-24 w-24 rounded-md object-cover'
                                            />
                                            <Button
                                                type='button'
                                                variant='destructive'
                                                size='icon'
                                                className='absolute right-1 top-1 h-6 w-6'
                                                onClick={() => removeImage(index)}
                                                disabled={isLoading}>
                                                <X className='h-4 w-4' />
                                            </Button>
                                        </div>
                                    ))}
                                    <Label
                                        htmlFor='source-images-upload'
                                        className='flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-white/30 bg-black/20 text-white/60 hover:border-white/50 hover:text-white'>
                                        <Upload className='h-8 w-8' />
                                        <span>Upload</span>
                                    </Label>
                                </div>
                                <input
                                    id='source-images-upload'
                                    type='file'
                                    multiple
                                    accept='image/*'
                                    onChange={handleFileChange}
                                    className='hidden'
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                    )}

                    <div className='space-y-2'>
                        <Label htmlFor='n-slider' className='text-white'>
                            Number of Images: {n[0]}
                        </Label>
                        <Slider
                            id='n-slider'
                            min={1}
                            max={10}
                            step={1}
                            value={n}
                            onValueChange={setN}
                            disabled={isLoading}
                            className='mt-3 [&>button]:border-black [&>button]:bg-white [&>button]:ring-offset-black [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white'
                        />
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>Size</Label>
                        <RadioGroup
                            value={size}
                            onValueChange={(value) => setSize(value as GenerationFormData['size'])}
                            disabled={isLoading}
                            className='flex flex-wrap gap-x-5 gap-y-3'>
                            <RadioItemWithIcon value='auto' id='size-auto' label='Auto' Icon={Sparkles} />
                            <RadioItemWithIcon value='1024x1024' id='size-square' label='Square' Icon={Square} />
                            <RadioItemWithIcon
                                value='1536x1024'
                                id='size-landscape'
                                label='Landscape'
                                Icon={RectangleHorizontal}
                            />
                            <RadioItemWithIcon
                                value='1024x1536'
                                id='size-portrait'
                                label='Portrait'
                                Icon={RectangleVertical}
                            />
                        </RadioGroup>
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>Quality</Label>
                        <RadioGroup
                            value={quality}
                            onValueChange={(value) => setQuality(value as GenerationFormData['quality'])}
                            disabled={isLoading}
                            className='flex flex-wrap gap-x-5 gap-y-3'>
                            <RadioItemWithIcon value='auto' id='quality-auto' label='Auto' Icon={Sparkles} />
                            <RadioItemWithIcon value='low' id='quality-low' label='Low' Icon={Tally1} />
                            <RadioItemWithIcon value='medium' id='quality-medium' label='Medium' Icon={Tally2} />
                            <RadioItemWithIcon value='high' id='quality-high' label='High' Icon={Tally3} />
                        </RadioGroup>
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>Background</Label>
                        <RadioGroup
                            value={background}
                            onValueChange={(value) => setBackground(value as GenerationFormData['background'])}
                            disabled={isLoading}
                            className='flex flex-wrap gap-x-5 gap-y-3'>
                            <RadioItemWithIcon value='auto' id='bg-auto' label='Auto' Icon={Sparkles} />
                            <RadioItemWithIcon value='opaque' id='bg-opaque' label='Opaque' Icon={BrickWall} />
                            <RadioItemWithIcon
                                value='transparent'
                                id='bg-transparent'
                                label='Transparent'
                                Icon={Eraser}
                            />
                        </RadioGroup>
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>Output Format</Label>
                        <RadioGroup
                            value={outputFormat}
                            onValueChange={(value) => setOutputFormat(value as GenerationFormData['output_format'])}
                            disabled={isLoading}
                            className='flex flex-wrap gap-x-5 gap-y-3'>
                            <RadioItemWithIcon value='png' id='format-png' label='PNG' Icon={FileImage} />
                            <RadioItemWithIcon value='jpeg' id='format-jpeg' label='JPEG' Icon={FileImage} />
                            <RadioItemWithIcon value='webp' id='format-webp' label='WebP' Icon={FileImage} />
                        </RadioGroup>
                    </div>

                    {showCompression && (
                        <div className='space-y-2 pt-2 transition-opacity duration-300'>
                            <Label htmlFor='compression-slider' className='text-white'>
                                Compression: {compression[0]}%
                            </Label>
                            <Slider
                                id='compression-slider'
                                min={0}
                                max={100}
                                step={1}
                                value={compression}
                                onValueChange={setCompression}
                                disabled={isLoading}
                                className='mt-3 [&>button]:border-black [&>button]:bg-white [&>button]:ring-offset-black [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white'
                            />
                        </div>
                    )}

                    <div className='space-y-3'>
                        <Label className='block text-white'>Moderation Level</Label>
                        <RadioGroup
                            value={moderation}
                            onValueChange={(value) => setModeration(value as GenerationFormData['moderation'])}
                            disabled={isLoading}
                            className='flex flex-wrap gap-x-5 gap-y-3'>
                            <RadioItemWithIcon value='auto' id='mod-auto' label='Auto' Icon={ShieldCheck} />
                            <RadioItemWithIcon value='low' id='mod-low' label='Low' Icon={ShieldAlert} />
                        </RadioGroup>
                    </div>
                </CardContent>
                <CardFooter className='border-t border-white/10 p-4'>
                    <Button
                        type='submit'
                        disabled={isLoading || !prompt}
                        className='flex w-full items-center justify-center gap-2 rounded-md bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40'>
                        {isLoading && <Loader2 className='h-4 w-4 animate-spin' />}
                        {isLoading ? 'Generating...' : 'Generate'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
