import crypto from 'crypto';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { hasEnoughCredits, useCredits, canAccessMultiplePhotos } from '../../../../lib/credit-utils';

const outputDir = path.resolve(process.cwd(), 'generated-images');

// Define valid output formats for type safety
const VALID_OUTPUT_FORMATS = ['png', 'jpeg', 'webp'] as const;
type ValidOutputFormat = (typeof VALID_OUTPUT_FORMATS)[number];

// Validate and normalize output format
function validateOutputFormat(format: unknown): ValidOutputFormat {
    const normalized = String(format || 'png').toLowerCase();
    const mapped = normalized === 'jpg' ? 'jpeg' : normalized;
    if (VALID_OUTPUT_FORMATS.includes(mapped as ValidOutputFormat)) {
        return mapped as ValidOutputFormat;
    }
    return 'png';
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
            throw new Error('Failed to access or ensure image output directory exists.');
        }
    }
}

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

// Generate multi-person prompt
function generateMultiPersonPrompt(data: {
    coloringPageType: 'facial_portrait' | 'cartoon_portrait';
    nameMessage?: string;
    background?: 'plain' | 'mindful';
    activityInterest?: string;
    sceneDescription?: string;
    individualNames?: { name: string; position: number }[];
    individualActivities?: { activity: string; position: number }[];
    photoCount: number;
}): string {
    const { coloringPageType, nameMessage, background, activityInterest, sceneDescription, individualNames, individualActivities, photoCount } = data;

    if (coloringPageType === 'facial_portrait') {
        let prompt = "Create a multi-person coloring page by following these steps precisely:\n\n";

        for (let i = 0; i < photoCount; i++) {
            const nameData = individualNames?.find(n => n.position === i);
            const photoNumber = i === 0 ? 'first' : i === 1 ? 'second' : i === 2 ? 'third' : `${i + 1}th`;

            prompt += `For the ${photoNumber} photo:\n`;
            prompt += `1. Turn the face into a line drawing, paying extra care to accurately represent facial features.\n`;
            prompt += `2. Place the resulting face inside its own plain white box with a black outline.\n`;
            if (nameData) {
                prompt += `3. Write "${nameData.name}" using friendly white letters with a black outline, suitable for a coloring page, under the box.\n\n`;
            } else {
                prompt += "\n";
            }
        }

        prompt += "Finally, arrange all the created boxes elegantly on the page.";

        if (background === 'mindful') {
            prompt += ' Place the entire composition on top of an abstract pattern suitable for mindful coloring.';
        } else {
            prompt += ' Place the entire composition on a plain white background.';
        }

        if (nameMessage && nameMessage.trim()) {
            prompt += ` As a final touch, include "${nameMessage.trim()}" written in friendly white letters with a black outline, suited to a coloring page, positioned unobtrusively.`;
        }

        return prompt;

    } else { // cartoon_portrait
        // Check if we have individual activities
        if (individualActivities && individualActivities.length > 0) {
            let prompt = "Create a multi-person cartoon coloring page by following these steps precisely:\n\n";

            for (let i = 0; i < photoCount; i++) {
                const activityData = individualActivities?.find(a => a.position === i);
                const photoNumber = i === 0 ? 'first' : i === 1 ? 'second' : i === 2 ? 'third' : `${i + 1}th`;

                prompt += `For the ${photoNumber} photo:\n`;
                prompt += `1. Turn the face into a line drawing, paying extra care to accurately represent facial features.\n`;
                prompt += `2. Place the result onto a cartoon-style line drawing body, also suitable for a coloring page.\n`;
                if (activityData) {
                    prompt += `3. Show this cartoon person engaged in ${activityData.activity}.\n\n`;
                } else {
                    prompt += `3. Create a generic cartoon body pose.\n\n`;
                }
            }

            // Add scene description if provided
            if (sceneDescription && sceneDescription.trim()) {
                prompt += `Place all characters in the scene: ${sceneDescription.trim()}, drawn in a coloring page style. `;
            } else {
                prompt += "Arrange all the cartoon characters elegantly on the page. ";
            }

            if (background === 'mindful') {
                prompt += 'Place everything on top of an abstract pattern suitable for mindful coloring.';
            } else {
                prompt += 'Place everything on a plain white background.';
            }

            if (nameMessage && nameMessage.trim()) {
                prompt += ` Include "${nameMessage.trim()}" written in friendly white letters with black outline, suited to a coloring page, positioned unobtrusively.`;
            }

            return prompt;
        } else {
            // Fallback to original approach for backward compatibility
            let basePrompt = 'turn the faces in the photographs into line drawings suitable for a coloring page, taking extra care to accurately represent facial features. place the results onto cartoon-style line drawing bodies, also suitable for a coloring page.';
            
            if (sceneDescription && sceneDescription.trim()) {
                basePrompt += ` The people should be ${sceneDescription.trim()}, also drawn in a coloring page style.`;
            } else if (activityInterest && activityInterest.trim()) {
                basePrompt += ` The people should be engaged in ${activityInterest.trim()}, also drawn in a coloring page style.`;
            }
        
            if (background === 'mindful') {
                basePrompt += ' Place everything on top of an abstract pattern suitable for mindful coloring.';
            } else {
                basePrompt += ' Place everything on a plain white background.';
            }
        
            if (nameMessage && nameMessage.trim()) {
                basePrompt += ` Include "${nameMessage.trim()}" written in friendly white letters with black outline, suited to a coloring page, positioned unobtrusively.`;
            }
            
            return basePrompt;
        }
    }
}

// Convert image to data URL (base64) instead of uploading to Replicate
async function convertImageToDataUrl(imageBuffer: Buffer): Promise<string> {
    const base64 = imageBuffer.toString('base64');
    return `data:image/png;base64,${base64}`;
}

// Create Replicate prediction
async function createReplicatePrediction(input: any, token: string): Promise<any> {
    const requestBody = {
        version: "openai/gpt-image-1", // Use the actual model name
        input: input,
    };

    console.log('Creating Replicate prediction with:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Replicate prediction error:', errorText);
        throw new Error(`Failed to create Replicate prediction: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
}

// Poll Replicate prediction until complete
async function pollReplicatePrediction(predictionId: string, token: string, maxWaitTime = 300000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
        const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to get prediction status: ${response.statusText}`);
        }

        const prediction = await response.json();
        
        if (prediction.status === 'succeeded') {
            return prediction;
        } else if (prediction.status === 'failed') {
            throw new Error(`Replicate prediction failed: ${prediction.error || 'Unknown error'}`);
        }
        
        // Wait 2 seconds before polling again
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Replicate prediction timed out');
}

export async function POST(request: NextRequest) {
    console.log('Received POST request to /api/images/replicate');
    
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    
    if (!replicateToken) {
        return NextResponse.json({ error: 'Replicate API token not configured' }, { status: 500 });
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

        if (effectiveStorageMode === 'fs') {
            await ensureOutputDirExists();
        }

        const formData = await request.formData();

        // Password check
        if (process.env.APP_PASSWORD) {
            const clientPasswordHash = formData.get('passwordHash') as string | null;
            if (!clientPasswordHash) {
                return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
            }
            const serverPasswordHash = sha256(process.env.APP_PASSWORD);
            if (clientPasswordHash !== serverPasswordHash) {
                return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
            }
        }

        // Extract user email for credit checking
        const userEmail = formData.get('userEmail') as string | null;
        if (!userEmail) {
            return NextResponse.json({ error: 'User email is required for multi-person coloring pages.' }, { status: 400 });
        }

        // Check if user has enough credits (2 credits required for multi-person)
        const REQUIRED_CREDITS = 2;
        const hasSufficientCredits = await hasEnoughCredits(userEmail, REQUIRED_CREDITS);
        if (!hasSufficientCredits) {
            return NextResponse.json({ 
                error: `Insufficient credits. Multi-person coloring pages require ${REQUIRED_CREDITS} credits.` 
            }, { status: 402 }); // 402 Payment Required
        }

        // Check if user can access multiple photos feature (subscription tier check)
        const canAccess = await canAccessMultiplePhotos(userEmail);
        if (!canAccess) {
            return NextResponse.json({ 
                error: 'Multi-person coloring pages require Standard or Premium subscription. Please upgrade your plan to access this feature.' 
            }, { status: 403 }); // 403 Forbidden
        }

        console.log(`User ${userEmail} has sufficient credits (${REQUIRED_CREDITS}) and subscription access for multi-person generation`);

        // Extract form data
        const coloringPageType = formData.get('coloringPageType') as 'facial_portrait' | 'cartoon_portrait';
        const orientation = formData.get('orientation') as 'portrait' | 'landscape' | null;
        const nameMessage = formData.get('nameMessage') as string | null;
        const background = formData.get('background') as 'plain' | 'mindful' | null;
        const activityInterest = formData.get('activityInterest') as string | null;
        const sceneDescription = formData.get('sceneDescription') as string | null;

        // Extract individual names for facial portraits in correct order
        const individualNamesWithPositions: Array<{name: string, position: number}> = [];
        let nameIndex = 0;
        while (true) {
            const nameValue = formData.get(`individualName_${nameIndex}`) as string | null;
            if (nameValue === null) {
                break; // No more names
            }
            if (nameValue.trim()) {
                individualNamesWithPositions.push({
                    name: nameValue.trim(),
                    position: nameIndex
                });
            }
            nameIndex++;
        }

        // Extract individual activities for cartoon portraits in correct order
        const individualActivitiesWithPositions: Array<{activity: string, position: number}> = [];
        let activityIndex = 0;
        while (true) {
            const activityValue = formData.get(`individualActivity_${activityIndex}`) as string | null;
            if (activityValue === null) {
                break; // No more activities
            }
            if (activityValue.trim()) {
                individualActivitiesWithPositions.push({
                    activity: activityValue.trim(),
                    position: activityIndex
                });
            }
            activityIndex++;
        }
        
        console.log('Individual names with positions:', individualNamesWithPositions);
        console.log('Individual activities with positions:', individualActivitiesWithPositions);

        // Get all uploaded images
        const imageFiles: File[] = [];
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('photo_') && value instanceof File) {
                imageFiles.push(value);
            }
        }

        if (imageFiles.length === 0) {
            return NextResponse.json({ error: 'No images provided for multi-person coloring page.' }, { status: 400 });
        }

        console.log(`Processing ${imageFiles.length} images for multi-person coloring page`);

        // Convert all images to data URLs
        const imageUrls: string[] = [];
        for (const file of imageFiles) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const dataUrl = await convertImageToDataUrl(buffer);
            imageUrls.push(dataUrl);
        }

        console.log('All images converted to data URLs');

        // Generate prompt
        const prompt = generateMultiPersonPrompt({
            coloringPageType,
            nameMessage: nameMessage || undefined,
            background: background || undefined,
            activityInterest: activityInterest || undefined,
            sceneDescription: sceneDescription || undefined,
            individualNames: individualNamesWithPositions,
            individualActivities: individualActivitiesWithPositions,
            photoCount: imageFiles.length,
        });

        console.log('Generated prompt:', prompt);

        // Set aspect ratio based on orientation
        const aspectRatio = orientation === 'landscape' ? '3:2' : '2:3';

        // Create Replicate prediction
        const input = {
            prompt: prompt,
            quality: 'high',
            background: 'auto',
            moderation: 'auto',
            aspect_ratio: aspectRatio,
            input_images: imageUrls,
            output_format: 'png',
            input_fidelity: 'high',
            openai_api_key: process.env.OPENAI_API_KEY,
            number_of_images: 1,
            output_compression: 90
        };

        const prediction = await createReplicatePrediction(input, replicateToken);
        console.log('Created Replicate prediction:', prediction.id);

        // Poll for completion
        const completedPrediction = await pollReplicatePrediction(prediction.id, replicateToken);
        console.log('Replicate prediction completed');

        // Download the result image
        if (!completedPrediction.output || completedPrediction.output.length === 0) {
            throw new Error('No output received from Replicate');
        }

        const imageUrl = completedPrediction.output[0];
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error('Failed to download generated image');
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        
        // Save the image
        const timestamp = Date.now();
        const fileExtension = validateOutputFormat('png');
        const filename = `${timestamp}-multi-person.${fileExtension}`;

        const imageResult: { filename: string; b64_json: string; path?: string; output_format: string } = {
            filename: filename,
            b64_json: imageBuffer.toString('base64'),
            output_format: fileExtension
        };

        if (effectiveStorageMode === 'fs') {
            const filepath = path.join(outputDir, filename);
            await fs.writeFile(filepath, imageBuffer);
            imageResult.path = `/api/image/${filename}`;
        }

        console.log('Multi-person coloring page generation completed');

        // Deduct credits after successful generation
        console.log('=== CREDIT DEDUCTION PROCESS STARTING ===');
        console.log('User email for deduction:', userEmail);
        console.log('Required credits:', REQUIRED_CREDITS);
        console.log('Image result created successfully, proceeding with credit deduction...');
        
        try {
            console.log(`🔄 Attempting to deduct ${REQUIRED_CREDITS} credits from user: ${userEmail}`);
            const updatedUser = await useCredits(userEmail, REQUIRED_CREDITS);
            console.log(`✅ Successfully deducted ${REQUIRED_CREDITS} credits from user ${userEmail}. New balance: ${updatedUser.credits}`);
            console.log('=== CREDIT DEDUCTION SUCCESS ===');
        } catch (creditError) {
            console.error('🚨 CRITICAL ERROR: Failed to deduct credits after successful image generation!');
            console.error('❌ User email:', userEmail);
            console.error('❌ Required credits:', REQUIRED_CREDITS);
            console.error('❌ Full error object:', creditError);
            
            // Log the full error details
            if (creditError instanceof Error) {
                console.error('❌ Error name:', creditError.name);
                console.error('❌ Error message:', creditError.message);
                console.error('❌ Error stack:', creditError.stack);
            }
            
            // Log the error type and additional info
            console.error('❌ Error type:', typeof creditError);
            console.error('❌ Error constructor:', creditError?.constructor?.name);
            console.error('=== CREDIT DEDUCTION FAILED ===');
            
            // Since the image was already generated successfully, we should still return it
            // but we need to alert about the credit issue
            return NextResponse.json({ 
                images: [imageResult],
                usage: completedPrediction.metrics,
                warning: 'Image generated successfully but there was an issue updating your credits. Please contact support if your credit balance is incorrect.'
            });
        }

        return NextResponse.json({ 
            images: [imageResult],
            usage: completedPrediction.metrics 
        });

    } catch (error: unknown) {
        console.error('Error in /api/images/replicate:', error);

        let errorMessage = 'An unexpected error occurred.';
        let status = 500;

        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return NextResponse.json({ error: errorMessage }, { status });
    }
}
