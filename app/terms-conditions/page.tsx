import Image from 'next/image';

export default function TermsConditionsPage() {
  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Side - Weight Loss Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#dfedfb] items-center justify-center overflow-hidden rounded-tr-3xl rounded-br-3xl">
        <div className="w-full h-full relative">
          {/* Weight Loss Image */}
          <Image
            src="/images/ablogin.jpg"
            alt="Weight Loss"
            fill
            className="object-cover rounded-tr-3xl rounded-br-3xl"
            priority
            unoptimized
          />
          {/* Dark Overlay - Stronger at bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/20 to-black/70 rounded-tr-3xl rounded-br-3xl"></div>
          {/* Copyright Text */}
          <div className="absolute bottom-6 left-0 right-0 text-center px-2">
            <p className="text-white text-sm">© 2026 Alternate Health Club. All Rights Reserved.</p>
          </div>
        </div>
      </div>

      {/* Right Side - Terms & Conditions Content */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8 lg:p-16 overflow-hidden">
        <div className="w-full max-w-2xl h-full flex flex-col">
          {/* Header */}
          <div className="space-y-2 pb-4 border-b border-[#dfedfb] flex-shrink-0">
            <h1 className="text-4xl font-bold text-[#435970]">Terms & Conditions</h1>
            <p className="text-[#7895b3] text-sm">Last updated: January 2026</p>
          </div>

          {/* Content */}
          <div className="space-y-3 text-[#435970] flex-1 pt-4 overflow-y-auto">
            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">1. Acceptance of Terms</h2>
              <p className="text-[#435970] leading-tight text-sm">
                By accessing and using the Alternate Health Club website and services, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">2. Use License</h2>
              <p className="text-[#435970] leading-tight mb-2 text-sm">
                Permission is granted to temporarily download one copy of the materials on Alternate Health Club&apos;s website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[#435970] ml-4 text-sm">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose or for any public display</li>
                <li>Attempt to decompile or reverse engineer any software contained on the website</li>
                <li>Remove any copyright or other proprietary notations from the materials</li>
                <li>Transfer the materials to another person or &quot;mirror&quot; the materials on any other server</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">3. Membership & Services</h2>
              <p className="text-[#435970] leading-tight mb-2 text-sm">
                Alternate Health Club offers various membership plans and services. By purchasing a membership, you agree to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[#435970] ml-4 text-sm">
                <li>Provide accurate and complete information during registration</li>
                <li>Maintain the security of your account credentials</li>
                <li>Use the services in accordance with all applicable laws and regulations</li>
                <li>Not share your account with others</li>
                <li>Pay all fees associated with your membership in a timely manner</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">4. Health & Safety Disclaimer</h2>
              <p className="text-[#435970] leading-tight text-sm">
                The information provided by Alternate Health Club is for general informational purposes only. All information on the site is provided in good faith, however we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability or completeness of any information on the site. Before beginning any exercise program or making changes to your diet, please consult with a healthcare professional.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">5. Payment Terms</h2>
              <p className="text-[#435970] leading-tight mb-2 text-sm">
                All membership fees are due in advance. We accept various payment methods including credit cards, debit cards, and electronic transfers. By providing payment information, you authorize us to charge your payment method for all fees associated with your membership.
              </p>
              <p className="text-[#435970] leading-tight text-sm">
                Refunds are subject to our refund policy, which may vary based on the type of membership and services purchased. Please contact our customer service team for specific refund inquiries.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">6. Cancellation Policy</h2>
              <p className="text-[#435970] leading-tight text-sm">
                You may cancel your membership at any time by contacting our customer service team or through your account settings. Cancellation requests must be submitted at least 7 days before your next billing cycle to avoid being charged for the following period. Once cancelled, you will continue to have access to services until the end of your current billing period.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">7. Privacy Policy</h2>
              <p className="text-[#435970] leading-tight text-sm">
                Your use of our services is also governed by our Privacy Policy. Please review our Privacy Policy, which explains how we collect, use, and protect your personal information when you use our services.
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">8. Limitation of Liability</h2>
              <p className="text-[#435970] leading-tight text-sm">
                In no event shall Alternate Health Club, its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your use of or inability to use the service.
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">9. Changes to Terms</h2>
              <p className="text-[#435970] leading-tight text-sm">
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">10. Contact Information</h2>
              <p className="text-[#435970] leading-tight text-sm">
                If you have any questions about these Terms & Conditions, please contact us at:
              </p>
              <div className="mt-3 space-y-1 text-[#435970]">
                <p><strong>Email:</strong> support@alternatehealthclub.com</p>
                <p><strong>Phone:</strong> (555) 123-4567</p>
                <p><strong>Address:</strong> 123 Health Street, Wellness City, WC 12345</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

