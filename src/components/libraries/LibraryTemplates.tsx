'use client';

import { LIBRARY_TEMPLATES, LibraryTemplate, LibraryTemplateType } from '@/types';
import styles from './LibraryTemplates.module.css';
import { PenLine } from 'lucide-react';

interface LibraryTemplatesProps {
    selectedTemplate: LibraryTemplateType | null;
    onSelectTemplate: (template: LibraryTemplate | null) => void;
}

export default function LibraryTemplates({ selectedTemplate, onSelectTemplate }: LibraryTemplatesProps) {
    return (
        <div>
            <div className={styles.templatesGrid}>
                {LIBRARY_TEMPLATES.map(template => (
                    <div
                        key={template.id}
                        className={`${styles.templateCard} ${selectedTemplate === template.id ? styles.selected : ''}`}
                        onClick={() => onSelectTemplate(template)}
                    >
                        <span className={styles.templateIcon}>{template.icon}</span>
                        <span className={styles.templateName}>{template.name}</span>
                        <span className={styles.templateDesc}>{template.description}</span>
                    </div>
                ))}
            </div>

            <div className={styles.divider}>or</div>

            <div
                className={`${styles.customOption} ${selectedTemplate === 'custom' ? styles.selected : ''}`}
                onClick={() => onSelectTemplate(null)}
            >
                <PenLine size={18} />
                <span>Create custom library</span>
            </div>
        </div>
    );
}
