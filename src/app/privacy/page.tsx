import styles from './legal.module.css';

export default function PrivacyPage() {
    return (
        <div className={styles.legalContainer}>
            <h1 className={styles.title}>Privacy Policy</h1>
            <p className={styles.lastUpdated}>Last updated: December 2024</p>

            <section className={styles.section}>
                <h2>1. Information We Collect</h2>
                <p>We collect information you provide directly to us, including:</p>
                <ul>
                    <li><strong>Account Information:</strong> Email address and password when you create an account</li>
                    <li><strong>Social Media Tokens:</strong> OAuth access tokens to connect your social media accounts</li>
                    <li><strong>Content:</strong> Posts, images, and other content you create using our Service</li>
                    <li><strong>Usage Data:</strong> Information about how you interact with our Service</li>
                </ul>
            </section>

            <section className={styles.section}>
                <h2>2. How We Use Your Information</h2>
                <p>We use the information we collect to:</p>
                <ul>
                    <li>Provide, maintain, and improve the Service</li>
                    <li>Publish content to your connected social media accounts</li>
                    <li>Send you technical notices and support messages</li>
                    <li>Respond to your comments and questions</li>
                </ul>
            </section>

            <section className={styles.section}>
                <h2>3. Information Sharing</h2>
                <p>We do not sell your personal information. We may share your information:</p>
                <ul>
                    <li>With social media platforms you connect to publish your content</li>
                    <li>With service providers who assist in operating our Service</li>
                    <li>If required by law or to protect our rights</li>
                </ul>
            </section>

            <section className={styles.section}>
                <h2>4. Data Security</h2>
                <p>
                    We implement appropriate security measures to protect your personal information.
                    However, no method of transmission over the Internet is 100% secure, and we cannot
                    guarantee absolute security.
                </p>
            </section>

            <section className={styles.section}>
                <h2>5. OAuth and Social Media Connections</h2>
                <p>
                    When you connect social media accounts, we store OAuth tokens securely in our database.
                    These tokens allow us to post content on your behalf. You can revoke access at any time
                    by disconnecting the account in Settings or from the social media platform directly.
                </p>
            </section>

            <section className={styles.section}>
                <h2>6. Data Retention</h2>
                <p>
                    We retain your personal information for as long as your account is active.
                    You can request deletion of your account and associated data by contacting us.
                </p>
            </section>

            <section className={styles.section}>
                <h2>7. Your Rights</h2>
                <p>Depending on your location, you may have rights to:</p>
                <ul>
                    <li>Access your personal data</li>
                    <li>Correct inaccurate data</li>
                    <li>Request deletion of your data</li>
                    <li>Object to processing of your data</li>
                    <li>Export your data</li>
                </ul>
            </section>

            <section className={styles.section}>
                <h2>8. Cookies</h2>
                <p>
                    We use cookies to maintain your session and preferences.
                    These are essential for the Service to function properly.
                </p>
            </section>

            <section className={styles.section}>
                <h2>9. Changes to This Policy</h2>
                <p>
                    We may update this Privacy Policy from time to time. We will notify you of any
                    changes by posting the new policy on this page.
                </p>
            </section>

            <section className={styles.section}>
                <h2>10. Contact Us</h2>
                <p>
                    If you have questions about this Privacy Policy, please contact us at{' '}
                    <a href="mailto:privacy@socialsgenie.com">privacy@socialsgenie.com</a>
                </p>
            </section>
        </div>
    );
}
