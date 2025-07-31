import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth-context';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin']
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin']
});

export const metadata: Metadata = {
    title: 'Personalized Coloring Page Generator',
    description: "Generate and edit images using OpenAI's gpt-image-1 model.",
    icons: {
        icon: '/favicon.svg'
    }
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang='en' suppressHydrationWarning>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <ThemeProvider attribute='class' defaultTheme='dark' enableSystem={false} disableTransitionOnChange>
                    <AuthProvider>
                        {children}
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
