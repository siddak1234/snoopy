type FormErrorProps = {
  message: string | null | undefined;
  className?: string;
};

export function FormError({ message, className = "" }: FormErrorProps) {
  if (!message) return null;
  return (
    <p className={`text-sm text-[var(--error-text)] ${className}`.trim()} role="alert">
      {message}
    </p>
  );
}
