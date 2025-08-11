import { SignIn } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';

export default function SignInPage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative py-8 px-4">
      {/* Background gradient and decorative elements - optimized for mobile */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-teal-100 opacity-70 z-0"></div>
      
      {/* Decorative blobs - adjusted size for mobile */}
      <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-gradient-to-br from-teal-400/20 to-teal-500/30 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-0 left-0 w-64 sm:w-96 h-64 sm:h-96 bg-gradient-to-tr from-teal-500/20 to-teal-300/30 rounded-full blur-3xl -z-10"></div>
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,150,136,0.01)_1px,transparent_1px),linear-gradient(to_right,rgba(0,150,136,0.01)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
      
      {/* Logo for mobile view only - appears at the top */}
      <div className="block md:hidden relative z-10 mb-6">
        <Link href="/">
          <Image
            src="/background-transparent.png"
            alt="Aussie Steel Direct Logo"
            width={160}
            height={50}
            className="object-contain"
          />
        </Link>
      </div>
      
      {/* Main content container - now stacks properly on mobile */}
      <div className="relative z-10 w-full max-w-5xl flex flex-col md:flex-row shadow-xl rounded-2xl md:rounded-3xl overflow-hidden">
        {/* Left panel - Branding - hidden on very small screens, shown as top section on mobile */}
        <div className="w-full md:w-1/2 bg-gradient-to-br from-teal-600 to-teal-800 p-6 sm:p-8 md:p-12 flex flex-col justify-between text-white">
          {/* Only show the logo on desktop since we already show it at the top on mobile */}
          <div className="hidden md:block mb-6">
            <Image
              src="/background-transparent.png"
              alt="Aussie Steel Direct Logo"
              width={180}
              height={60}
              className="object-contain"
            />
          </div>
          
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-light mb-4 sm:mb-6">
              Welcome to<br />
              <span className="font-semibold">Aussie Steel Direct</span>
            </h1>
            
            <p className="text-teal-100 mb-6 sm:mb-8 text-sm sm:text-base">
              Sign in to access your dashboard, manage tenders, and connect with opportunities in steel procurement.
            </p>
          </div>
          
          {/* Feature list - simplified for mobile */}
          <div className="space-y-3 sm:space-y-4 mt-4 hidden sm:block">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-teal-500/30 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs sm:text-sm">Discover global steel opportunities</p>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-teal-500/30 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs sm:text-sm">Track tenders in real-time</p>
            </div>
          </div>
        </div>
        
        {/* Right panel - Sign in form */}
        <div className="w-full md:w-1/2 bg-white p-5 sm:p-8 md:p-12 flex items-center justify-center">
          <SignIn 
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none p-0 w-full mx-auto",
                
                header: "text-center",
                headerTitle: "text-xl sm:text-2xl font-semibold text-gray-800",
                headerSubtitle: "text-sm text-gray-600",
                socialButtonsBlockButton: "border border-gray-300 hover:bg-gray-50 text-sm",
                socialButtonsBlockButtonText: "text-gray-700 font-medium text-sm",
                dividerLine: "bg-gray-200",
                formButtonPrimary: "bg-gradient-to-r from-teal-500 to-teal-700 hover:from-teal-600 hover:to-teal-800 text-white font-medium py-2 px-4 rounded-md shadow-md transition-all duration-200 text-sm",
                footerActionLink: "text-teal-600 hover:text-teal-800 text-sm",
                formFieldInput: "border-gray-300 focus:ring-teal-500 focus:border-teal-500 rounded-md text-sm",
                identityPreviewEditButton: "text-teal-600 text-sm",
                formFieldLabel: "text-gray-700 text-sm",
                formFieldAction: "text-teal-600 text-sm",
                alertText: "text-sm",
                formFieldError: "text-sm",
                otpCodeFieldInput: "!h-9 !w-9 sm:!h-11 sm:!w-11 text-sm sm:text-base",
              },
              layout: {
                socialButtonsPlacement: "bottom",
                showOptionalFields: false,
               
              },
              variables: {
                colorPrimary: "#0d9488",
                colorText: "#374151",
                colorTextSecondary: "#4b5563",
                colorBackground: "#ffffff",
                fontFamily: "'Inter', sans-serif",
                spacingUnit: "0.75rem"
              }
            }}
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            redirectUrl="/dashboard/my-orders"
          />
        </div>
      </div>
      
      
    </div>
  );
}