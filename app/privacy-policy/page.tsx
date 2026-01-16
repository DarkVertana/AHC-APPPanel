import Image from 'next/image';

export default function PrivacyPolicyPage() {
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

      {/* Right Side - Privacy Policy Content */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8 lg:p-16 overflow-hidden">
        <div className="w-full max-w-2xl h-full flex flex-col">
          {/* Header */}
          <div className="space-y-2 pb-4 border-b border-[#dfedfb] flex-shrink-0">
            <h1 className="text-4xl font-bold text-[#435970]">Privacy Policy</h1>
            <p className="text-[#7895b3] text-sm">Last updated: January 2026</p>
          </div>

          {/* Content */}
          <div className="space-y-3 text-[#435970] flex-1 pt-4 overflow-y-auto">
            {/* Introduction */}
            <section>
              <p className="text-[#435970] leading-tight text-sm">
                At Alternate Health Club, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our services, or interact with us.
              </p>
            </section>

            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">1. Information We Collect</h2>
              <p className="text-[#435970] leading-tight mb-2 text-sm">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[#435970] ml-4 text-sm">
                <li><strong>Personal Information:</strong> Name, email address, phone number, date of birth, and mailing address</li>
                <li><strong>Account Information:</strong> Username, password, and profile information</li>
                <li><strong>Payment Information:</strong> Credit card numbers, billing address, and payment history</li>
                <li><strong>Health Information:</strong> Fitness goals, health conditions, workout preferences, and progress data</li>
                <li><strong>Communication Data:</strong> Messages, feedback, and correspondence with our support team</li>
              </ul>
              <p className="text-[#435970] leading-tight mt-2 text-sm">
                We also automatically collect certain information when you use our services, including device information, IP address, browser type, usage patterns, and cookies.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">2. How We Use Your Information</h2>
              <p className="text-[#435970] leading-tight mb-2 text-sm">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[#435970] ml-4 text-sm">
                <li>Provide, maintain, and improve our services</li>
                <li>Process your membership and payment transactions</li>
                <li>Personalize your experience and recommend relevant content</li>
                <li>Send you important updates, newsletters, and promotional materials</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Monitor and analyze usage patterns to improve our services</li>
                <li>Detect, prevent, and address technical issues and security threats</li>
                <li>Comply with legal obligations and enforce our terms of service</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">3. Information Sharing and Disclosure</h2>
              <p className="text-[#435970] leading-tight mb-2 text-sm">
                We do not sell your personal information. We may share your information in the following circumstances:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[#435970] ml-4 text-sm">
                <li><strong>Service Providers:</strong> With trusted third-party service providers who assist us in operating our business, such as payment processors, cloud hosting services, and analytics providers</li>
                <li><strong>Legal Requirements:</strong> When required by law, court order, or government regulation</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                <li><strong>Protection of Rights:</strong> To protect our rights, property, or safety, or that of our users or others</li>
                <li><strong>With Your Consent:</strong> When you have given us explicit permission to share your information</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">4. Data Security</h2>
              <p className="text-[#435970] leading-tight text-sm">
                We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include encryption, secure servers, access controls, and regular security assessments. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">5. Cookies and Tracking Technologies</h2>
              <p className="text-[#435970] leading-tight mb-2 text-sm">
                We use cookies and similar tracking technologies to collect and store information about your preferences and activity on our website. Cookies help us:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[#435970] ml-4 text-sm">
                <li>Remember your preferences and settings</li>
                <li>Analyze website traffic and usage patterns</li>
                <li>Improve user experience and functionality</li>
                <li>Provide personalized content and advertisements</li>
              </ul>
              <p className="text-[#435970] leading-relaxed mt-3">
                You can control cookies through your browser settings, but disabling cookies may limit your ability to use certain features of our website.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">6. Your Privacy Rights</h2>
              <p className="text-[#435970] leading-tight mb-2 text-sm">
                Depending on your location, you may have certain rights regarding your personal information, including:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[#435970] ml-4 text-sm">
                <li><strong>Access:</strong> Request access to your personal information</li>
                <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                <li><strong>Portability:</strong> Request transfer of your data to another service</li>
                <li><strong>Opt-Out:</strong> Opt-out of certain data processing activities, such as marketing communications</li>
                <li><strong>Objection:</strong> Object to processing of your personal information for certain purposes</li>
              </ul>
              <p className="text-[#435970] leading-relaxed mt-3">
                To exercise these rights, please contact us using the information provided in the Contact section below.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">7. Children&apos;s Privacy</h2>
              <p className="text-[#435970] leading-tight text-sm">
                Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected personal information from a child without parental consent, we will take steps to delete that information promptly.
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">8. Data Retention</h2>
              <p className="text-[#435970] leading-tight text-sm">
                We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When we no longer need your information, we will securely delete or anonymize it.
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">9. International Data Transfers</h2>
              <p className="text-[#435970] leading-tight text-sm">
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using our services, you consent to the transfer of your information to these countries.
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">10. Changes to This Privacy Policy</h2>
              <p className="text-[#435970] leading-tight text-sm">
                We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. We encourage you to review this Privacy Policy periodically.
              </p>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="text-xl font-semibold text-[#435970] mb-2">11. Contact Us</h2>
              <p className="text-[#435970] leading-tight mb-2 text-sm">
                If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="mt-3 space-y-1 text-[#435970]">
                <p><strong>Email:</strong> privacy@alternatehealthclub.com</p>
                <p><strong>Phone:</strong> (555) 123-4567</p>
                <p><strong>Address:</strong> 123 Health Street, Wellness City, WC 12345</p>
                <p><strong>Data Protection Officer:</strong> dpo@alternatehealthclub.com</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

