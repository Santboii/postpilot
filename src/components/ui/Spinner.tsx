import styles from './Spinner.module.css';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
    className?: string;
    fullScreen?: boolean;
    inline?: boolean;
}

export default function Spinner({
    size = 'md',
    text,
    className = '',
    fullScreen = false,
    inline = false
}: SpinnerProps) {

    if (fullScreen) {
        return (
            <div className={styles.fullScreen}>
                <div className={styles.container}>
                    <div className={`${styles.spinner} ${styles[size]}`} />
                    {text && <p>{text}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className={`${inline ? styles.inline : styles.container} ${className}`}>
            <div className={`${styles.spinner} ${styles[size]}`} />
            {text && <p>{text}</p>}
        </div>
    );
}
