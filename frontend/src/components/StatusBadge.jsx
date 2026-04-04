export default function StatusBadge({ admin, authenticated }) {
  let label, variant;
  if (admin && authenticated) {
    label = '🔑 Administrator Portal';
    variant = 'admin';
  } else if (admin && !authenticated) {
    label = '🔐 Login Required';
    variant = 'login';
  } else {
    label = '👤 Player Portal';
    variant = 'player';
  }
  return <div className={`status-badge ${variant}`}>{label}</div>;
}
