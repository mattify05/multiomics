import { motion } from "framer-motion";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="p-6 animate-fade-in">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card p-12 text-center"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Construction className="h-7 w-7 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground max-w-md">{description}</p>
          <span className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full font-medium">Coming Soon</span>
        </div>
      </motion.div>
    </div>
  );
}
