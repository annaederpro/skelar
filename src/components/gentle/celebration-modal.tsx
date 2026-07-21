"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CelebrationKind = "fish" | "turtle" | "egg";

interface CelebrationModalProps {
  kind: CelebrationKind | null;
  taskTitle: string;
  onClose: () => void;
}

const CONTENT: Record<
  CelebrationKind,
  { tag: string; tagClass: string; emoji: string; title: string; sub: (name: string) => string; btn: string }
> = {
  fish: {
    tag: "Новий мешканець",
    tagClass: "bg-sea-soft text-sea-deep",
    emoji: "🐠",
    title: "Нова рибка у акваріумі",
    sub: (name) => `«${name}» — зроблено. Рибка запливла до тебе. Пишаюся тобою.`,
    btn: "До акваріума 🐚",
  },
  turtle: {
    tag: "Ікринка виросла",
    tagClass: "bg-sea-soft text-sea-deep",
    emoji: "🐢",
    title: "З ікринки хтось виплив",
    sub: (name) => `Ти повернувся й довів «${name}» до кінця. Тепер у твоєму акваріумі більше життя.`,
    btn: "Прекрасно",
  },
  egg: {
    tag: "Ікринку залишено",
    tagClass: "bg-coral-soft text-coral",
    emoji: "🥚",
    title: "Ти залишив ікринку",
    sub: (name) => `Ти вже почав «${name}» — і це рахується. Повернись, коли буде ресурс, і з ікринки хтось виросте.`,
    btn: "Добре",
  },
};

export function CelebrationModal({ kind, taskTitle, onClose }: CelebrationModalProps) {
  const content = kind ? CONTENT[kind] : null;

  return (
    <Dialog open={kind !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="text-center" showCloseButton={false}>
        {content && (
          <>
            <span
              className={cn(
                "mx-auto mb-3.5 inline-block rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide",
                content.tagClass,
              )}
            >
              {content.tag}
            </span>
            <div className="mb-2 text-5xl">{content.emoji}</div>
            <h2 className="font-heading text-xl font-semibold leading-tight">{content.title}</h2>
            <p className="mx-auto mt-2.5 max-w-[280px] text-sm leading-relaxed text-ink-soft">
              {content.sub(taskTitle)}
            </p>
            <Button onClick={onClose} className="mt-5 w-full rounded-2xl bg-sea py-5 font-extrabold hover:bg-sea-deep">
              {content.btn}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
