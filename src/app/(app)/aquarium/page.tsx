export default function AquariumPage() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[22px] border border-line bg-card px-4 py-14 text-center">
      <span className="text-4xl">🐠</span>
      <h2 className="font-heading text-lg font-semibold">Твій акваріум</h2>
      <p className="max-w-[240px] text-sm leading-relaxed text-ink-soft">
        Тут оживатиме риф: кожна виконана задача додаватиме мешканця. Незабаром.
      </p>
    </div>
  );
}
