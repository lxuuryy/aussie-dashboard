import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Create a matcher for all public routes
// This includes the home page '/', sign-in routes, and any other public routes
const isPublicRoute = createRouteMatcher([


  
  // Add this line
])

export default clerkMiddleware(async (auth, req) => {
  // Only protect routes that are not defined as public

})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes and dashboard routes
    '/(dashboard)(.*)',
  ],
}