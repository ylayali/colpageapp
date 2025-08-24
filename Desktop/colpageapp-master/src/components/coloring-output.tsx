'use client';

import * as React from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';

interface ColoringOutputProps {
  imageBatch: { path: string; filename: string }[] | null;
  altText: string;
  isLoading: boolean;
  photoPreview?: string | null;
}

export function ColoringOutput({ imageBatch, altText, isLoading, photoPreview }: ColoringOutputProps) {
  const handlePrint = (imagePath: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Coloring Page</title>
            <style>
              @page {
                margin: 0;
                size: auto;
              }
              
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                margin: 0;
                padding: 0;
                background: white;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
              }
              
              .print-container {
                width: 100%;
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                background: white;
              }
              
              .print-image {
                max-width: 100%;
                max-height: 100%;
                width: auto;
                height: auto;
                object-fit: contain;
                background: white;
              }
              
              /* Hide any metadata, headers, footers */
              @media print {
                body {
                  margin: 0 !important;
                  padding: 0 !important;
                }
                
                .print-container {
                  margin: 0 !important;
                  padding: 0 !important;
                  page-break-inside: avoid;
                }
                
                .print-image {
                  margin: 0 !important;
                  padding: 0 !important;
                }
                
                /* Hide browser print headers/footers */
                @page {
                  margin: 0mm;
                  size: auto;
                }
              }
              
              @media screen {
                body {
                  padding: 20px;
                }
              }
            </style>
          </head>
          <body>
            <div class="print-container">
              <img src="${imagePath}" alt="Coloring Page" class="print-image" onload="window.print(); window.close();" />
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleDownload = (imagePath: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imagePath;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <Card className="h-full bg-gray-900/50 border-gray-700">
        <CardContent className="flex h-full items-center justify-center p-6">
          <div className="text-center space-y-4">
            {photoPreview && (
              <div className="mb-4">
                <img 
                  src={photoPreview} 
                  alt="Preview" 
                  className="max-w-32 max-h-32 mx-auto rounded-lg opacity-50"
                />
              </div>
            )}
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <p className="text-white/60">Generating your coloring page...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!imageBatch || imageBatch.length === 0) {
    return (
      <Card className="h-full bg-gray-900/50 border-gray-700">
        <CardContent className="flex h-full items-center justify-center p-6">
          <p className="text-white/60 text-center">
            Upload a photo and configure your settings to generate a coloring page
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-gray-900/50 border-gray-700">
      <CardContent className="p-6 h-full">
        <div className="space-y-4 h-full">
          <h3 className="text-lg font-semibold text-white mb-4">Generated Coloring Page{imageBatch.length > 1 ? 's' : ''}</h3>
          
          <div className="grid gap-4 h-full" style={{ gridTemplateRows: imageBatch.length > 1 ? 'repeat(auto-fit, minmax(200px, 1fr))' : '1fr' }}>
            {imageBatch.map((image, index) => (
              <div key={index} className="space-y-3">
                <div className="relative group">
                  <img 
                    src={image.path} 
                    alt={`${altText} ${index + 1}`}
                    className="w-full h-auto max-h-96 object-contain rounded-lg border border-gray-600 bg-white"
                  />
                  
                  {/* Print/Download overlay - hidden in print */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center space-x-4 print:hidden">
                    <Button
                      onClick={() => handlePrint(image.path)}
                      variant="secondary"
                      size="sm"
                      className="bg-white/90 text-black hover:bg-white"
                    >
                      Print
                    </Button>
                    <Button
                      onClick={() => handleDownload(image.path, image.filename)}
                      variant="secondary"
                      size="sm"
                      className="bg-white/90 text-black hover:bg-white"
                    >
                      Download
                    </Button>
                  </div>
                </div>
                
                {/* Metadata - hidden in print */}
                <div className="text-xs text-white/40 print:hidden">
                  <p>Filename: {image.filename}</p>
                  <p>Generated: {new Date().toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
