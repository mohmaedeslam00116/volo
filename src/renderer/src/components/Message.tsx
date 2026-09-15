/** Bidi-safe message: prose auto-dir, fenced code forced LTR (The LTR-Code Rule). */
export function Message({ text }: { text: string }) {
  const parts = String(text ?? "").split(/```/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <pre key={i} dir="ltr">
            {p.replace(/^\w*\n/, "")}
          </pre>
        ) : (
          <p key={i} dir="auto">
            {p}
          </p>
        ),
      )}
    </>
  );
}
