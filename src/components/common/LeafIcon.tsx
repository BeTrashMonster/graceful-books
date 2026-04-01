/**
 * Leaf Icon Component
 *
 * Shows green leaf when inactive, nothing when active
 */

interface LeafIconProps {
  isActive: boolean;
  size?: number;
}

export function LeafIcon({ isActive, size = 18 }: LeafIconProps) {
  // Don't show icon for active tab
  if (isActive) {
    return null;
  }

  // Show green leaf for inactive tabs
  return (
    <img
      src="/assets/icons/leaf-inactive.png"
      alt=""
      style={{
        width: `${size}px`,
        height: `${size}px`,
        marginRight: '8px',
      }}
    />
  );
}
