export default function Toast({ message, type }) {
  if (!message) return null;
  return (
    <div className={type === 'error' ? 'error-toast' : 'success-toast'}>
      {message}
    </div>
  );
}
