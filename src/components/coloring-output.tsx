'use client';

import { Button } from '@/components/ui/button';
import { Loader2, Download, Printer } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

type ImageInfo = {
    path: string;
    filename: string;
};

type ColoringOutputProps = {
    imageBatch: ImageInfo[] | null;
    altText?: string;
    isLoading: boolean;
    photoPreview?: string | null;
};

export function ColoringOutput({
    imageBatch,
    altText = 'Generated coloring page',
    isLoading,
    photoPreview
}: ColoringOutputProps) {
    const generatedImage = imageBatch?.[0];

    const handleDownload = async () => {
        if (!generatedImage) return;

        try {
            const response = await fetch(generatedImage.path);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = generatedImage.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    const handlePrint = async () => {
        if (!generatedImage) return;

        try {
            // First, convert the image to a data URL to ensure it's accessible
            const response = await fetch(generatedImage.path);
            const blob = await response.blob();
            const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });

            // Try opening a print window first
            const printWindow = window.open('', '_blank');
            
            if (printWindow) {
                // Pop-up allowed - use the pop-up method
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Coloring Page</title>
                        <style>
                            * {
                                margin: 0;
                                padding: 0;
                                box-sizing: border-box;
                            }
                            
                            @page {
                                margin: 0.5in;
                                size: auto;
                            }
                            
                            html, body {
                                width: 100%;
                                height: 100%;
                                background: white;
                            }
                            
                            body {
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                min-height: 100vh;
                            }
                            
                            img {
                                max-width: 100%;
                                max-height: 100vh;
                                object-fit: contain;
                                display: block;
                            }
                            
                            @media print {
                                img {
                                    width: 100%;
                                    height: auto;
                                    page-break-inside: avoid;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <img src="${dataUrl}" alt="Coloring Page" onload="setTimeout(() => { window.print(); window.close(); }, 100);" />
                    </body>
                    </html>
                `);
                printWindow.document.close();
            } else {
                // Pop-up blocked - use inline method
                const printArea = document.createElement('div');
                printArea.style.position = 'fixed';
                printArea.style.top = '0';
                printArea.style.left = '0';
                printArea.style.width = '100vw';
                printArea.style.height = '100vh';
                printArea.style.backgroundColor = 'white';
                printArea.style.zIndex = '9999';
                printArea.style.display = 'flex';
                printArea.style.justifyContent = 'center';
                printArea.style.alignItems = 'center';

                const img = document.createElement('img');
                img.src = dataUrl;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';
                img.style.objectFit = 'contain';

                const closeButton = document.createElement('button');
                closeButton.textContent = 'Close';
                closeButton.style.position = 'absolute';
                closeButton.style.top = '20px';
                closeButton.style.right = '20px';
                closeButton.style.padding = '10px 20px';
                closeButton.style.backgroundColor = '#000';
                closeButton.style.color = 'white';
                closeButton.style.border = 'none';
                closeButton.style.borderRadius = '5px';
                closeButton.style.cursor = 'pointer';

                printArea.appendChild(img);
                printArea.appendChild(closeButton);
                document.body.appendChild(printArea);

                closeButton.onclick = () => {
                    document.body.removeChild(printArea);
                };

                // Add print styles
                const printStyles = document.createElement('style');
                printStyles.textContent = `
                    @media print {
                        body > *:not([data-print-area]) {
                            display: none !important;
                        }
                        [data-print-area] {
                            position: static !important;
                            z-index: auto !important;
                        }
                        [data-print-area] button {
                            display: none !important;
                        }
                    }
                `;
                document.head.appendChild(printStyles);
                printArea.setAttribute('data-print-area', 'true');

                // Trigger print
                setTimeout(() => {
                    window.print();
                }, 100);
            }
        } catch (error) {
            console.error('Print failed:', error);
            alert('Failed to prepare image for printing. Please try downloading the image instead.');
        }
    };

    return (
        <div className='flex h-full min-h-[300px] w-full flex-col items-center justify-between gap-4 overflow-hidden rounded-lg border border-white/20 bg-black p-4'>
            <div className='relative flex h-full w-full flex-grow items-center justify-center overflow-hidden'>
                {isLoading ? (
                    photoPreview ? (
                        <div className='relative flex h-full w-full items-center justify-center'>
                            <Image
                                src={photoPreview}
                                alt='Uploaded photo preview'
                                fill
                                style={{ objectFit: 'contain' }}
                                className='blur-md filter'
                                unoptimized
                            />
                            <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white/80'>
                                <Loader2 className='mb-2 h-8 w-8 animate-spin' />
                                <p>Creating your coloring page...</p>
                            </div>
                        </div>
                    ) : (
                        <div className='flex flex-col items-center justify-center text-white/60'>
                            <Loader2 className='mb-2 h-8 w-8 animate-spin' />
                            <p>Creating your coloring page...</p>
                        </div>
                    )
                ) : generatedImage ? (
                    <Image
                        src={generatedImage.path}
                        alt={altText}
                        width={512}
                        height={768}
                        className='max-h-full max-w-full object-contain'
                        unoptimized
                    />
                ) : (
                    <div className='text-center text-white/40'>
                        <p>Your coloring page will appear here.</p>
                        <p className='mt-2 text-sm'>Upload a photo and fill out the form to get started.</p>
                    </div>
                )}
            </div>

            {generatedImage && !isLoading && (
                <div className='flex h-10 w-full shrink-0 items-center justify-center gap-4'>
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={handleDownload}
                        className='shrink-0 border-white/20 text-white/80 hover:bg-white/10 hover:text-white'>
                        <Download className='mr-2 h-4 w-4' />
                        Download
                    </Button>
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={handlePrint}
                        className='shrink-0 border-white/20 text-white/80 hover:bg-white/10 hover:text-white'>
                        <Printer className='mr-2 h-4 w-4' />
                        Print This Page
                    </Button>
                </div>
            )}
        </div>
    );
}
