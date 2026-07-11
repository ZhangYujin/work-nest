import vscodeIcon from '../../assets/vscode-icon.svg';

export function VSCodeIcon({ className }: { className?: string }) {
  return (
    <img
      src={vscodeIcon}
      alt="VS Code"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
