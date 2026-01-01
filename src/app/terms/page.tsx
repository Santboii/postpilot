import styles from './legal.module.css';

export default function TermsPage() {
    return (
        <div className={styles.legalContainer}>
            <h1 className={styles.title}>Terms of Use</h1>
            <p className={styles.lastUpdated}>Last updated: December 2025</p>

            <section className={styles.section}>
                <h2>1. Acceptance of Terms</h2>
                <p>
                    By accessing or using SocialsGenie ("the Service"), you agree to be bound by these Terms of Use.
                    If you do not agree to these terms, please do not use the Service.
                </p>
            </section>

            <section className={styles.section}>
                <h2>2. Description of Service</h2>
                <p>
                    SocialsGenie is an AI-powered social media management platform that allows users to create,
                    schedule, and publish content across multiple social media platforms including Facebook,
                    Instagram, Twitter, LinkedIn, and Threads.
                </p>
            </section>

            <section className={styles.section}>
                <h2>3. User Accounts</h2>
                <p>
                    To use certain features of the Service, you must create an account. You are responsible for:
                </p>
                <ul>
                    <li>Maintaining the confidentiality of your account credentials</li>
                    <li>All activities that occur under your account</li>
                    <li>Notifying us immediately of any unauthorized use</li>
                </ul>
            </section>

            <section className={styles.section}>
                <h2>4. Acceptable Use</h2>
                <p>You agree not to use the Service to:</p>
                <ul>
                    <li>Post content that is illegal, harmful, threatening, or discriminatory</li>
                    <li>Violate any applicable laws or regulations</li>
                    <li>Infringe upon intellectual property rights of others</li>
                    <li>Distribute spam or malicious content</li>
                    <li>Attempt to gain unauthorized access to the Service</li>
                </ul>
            </section>

            <section className={styles.section}>
                <h2>5. Third-Party Services</h2>
                <p>
                    The Service integrates with third-party platforms (Facebook, Instagram, etc.).
                    Your use of these integrations is subject to the respective platform&apos;s terms of service.
                    We are not responsible for the actions or policies of third-party services.
                </p>
            </section>

            <section className={styles.section}>
                <h2>6. Intellectual Property</h2>
                <p>
                    Content you create using the Service remains your property. However, you grant us a
                    limited license to process and store your content as necessary to provide the Service.
                </p>
            </section>

            <section className={styles.section}>
                <h2>7. Limitation of Liability</h2>
                <p>
                    The Service is provided "as is" without warranties of any kind. We shall not be liable
                    for any indirect, incidental, special, or consequential damages arising from your use
                    of the Service.
                </p>
            </section>

            <section className={styles.section}>
                <h2>8. Changes to Terms</h2>
                <p>
                    We reserve the right to modify these terms at any time. Continued use of the Service
                    after changes constitutes acceptance of the modified terms.
                </p>
            </section>

            <section className={styles.section}>
                <h2>9. Contact</h2>
                <p>
                    For questions about these Terms of Use, please contact us at{' '}
                    <a href="mailto:contact@socialsgenie.com">contact@socialsgenie.com</a>
                </p>
            </section>
        </div>
    );
}
