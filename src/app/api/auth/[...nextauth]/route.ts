import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

// Export the handler with named exports for GET and POST
export const GET = handler;
export const POST = handler; 