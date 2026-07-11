import opencodeIcon from '../../assets/opencode-icon.png';

export function OpencodeIcon({ className }: { className?: string }) {
  return (
    <img
      src={opencodeIcon}
      alt="Opencode"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
