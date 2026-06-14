import { CreateJoinForm } from "@/components/CreateJoinForm";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center gap-8 pt-16">
      <header className="text-center">
        <h1 className="text-5xl font-black tracking-tight">DraftOff</h1>
        <p className="mt-2 text-white/70">
          Draft football legends. Simulate glory.
        </p>
      </header>
      <CreateJoinForm />
    </div>
  );
}
