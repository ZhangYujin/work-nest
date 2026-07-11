import claudeIcon from '../../assets/claude-icon.svg';

export function ClaudeIcon({ className }: { className?: string }) {
  return (
    <img
      src={claudeIcon}
      alt="Claude"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
