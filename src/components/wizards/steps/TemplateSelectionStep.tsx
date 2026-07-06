/**
 * Template Selection Step Component
 *
 * Second step where users select an industry template.
 * Features:
 * - Friendly template names
 * - Clear descriptions
 * - Visual template cards
 * - Keyboard navigation
 */

import { type FC, useState } from 'react'
import { Button } from '../../core/Button'
import type { IndustryTemplate } from '../../../types/wizard.types'
import styles from './TemplateSelectionStep.module.css'

export interface TemplateSelectionStepProps {
  templates: IndustryTemplate[]
  selectedTemplateId?: string
  onSelect: (templateId: string) => void
  onBack: () => void
}

/**
 * Template Selection Step Component
 */
export const TemplateSelectionStep: FC<TemplateSelectionStepProps> = ({
  templates,
  selectedTemplateId,
  onSelect,
  onBack,
}) => {
  const [hoveredTemplateId, setHoveredTemplateId] = useState<string | null>(null)
  const [selectedForPreview, setSelectedForPreview] = useState<string | null>(selectedTemplateId || null)


  const handleTemplateClick = (templateId: string) => {
    setSelectedForPreview(templateId)
  }

  const handleConfirmSelection = () => {
    if (selectedForPreview) {
      onSelect(selectedForPreview)
    }
  }

  // Separate the "general" template to display differently
  const industryTemplates = templates.filter(t => t.id !== 'general')
  const basicTemplate = templates.find(t => t.id === 'general')

  return (
    <div className={styles.templateStep}>
      <div className={styles.intro}>
        <p className={styles.introText}>
          Pick a starting point that fits your business – you can customize everything in the next step.
        </p>
      </div>

      {basicTemplate && (
        <button
          type="button"
          className={`${styles.basicButton} ${
            selectedForPreview === basicTemplate.id ? styles.selected : ''
          }`}
          onClick={() => handleTemplateClick(basicTemplate.id)}
          aria-pressed={selectedForPreview === basicTemplate.id}
        >
          <span className={styles.basicButtonText}>
            {basicTemplate.friendlyName}
          </span>
          <span className={styles.basicButtonDesc}>
            {basicTemplate.description}
          </span>
          {selectedForPreview === basicTemplate.id && (
            <span className={styles.selectedBadge} aria-label="Selected">
              ✓
            </span>
          )}
        </button>
      )}

      <div className={styles.templateGrid}>
        {industryTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            className={`${styles.templateCard} ${
              selectedForPreview === template.id ? styles.selected : ''
            } ${hoveredTemplateId === template.id ? styles.hovered : ''}`}
            onClick={() => handleTemplateClick(template.id)}
            onMouseEnter={() => setHoveredTemplateId(template.id)}
            onMouseLeave={() => setHoveredTemplateId(null)}
            onFocus={() => setHoveredTemplateId(template.id)}
            onBlur={() => setHoveredTemplateId(null)}
            aria-pressed={selectedForPreview === template.id}
          >
            <div className={styles.templateHeader}>
              <h4 className={styles.templateName}>{template.friendlyName}</h4>
              {selectedForPreview === template.id && (
                <span className={styles.selectedBadge} aria-label="Selected">
                  ✓
                </span>
              )}
            </div>
            <p className={styles.templateDescription}>{template.description}</p>
          </button>
        ))}
      </div>

      <div className={styles.actions}>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirmSelection}
          disabled={!selectedForPreview}
        >
          Continue with this template
        </Button>
      </div>
    </div>
  )
}
