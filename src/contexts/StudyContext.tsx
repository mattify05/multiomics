import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "omicsai:selected-study-id";

type StudyContextValue = {
  selectedStudyId: string | null;
  setSelectedStudyId: (studyId: string | null) => void;
};

const StudyContext = createContext<StudyContextValue | undefined>(undefined);

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const [selectedStudyId, setSelectedStudyIdState] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setSelectedStudyIdState(saved);
  }, []);

  const setSelectedStudyId = (studyId: string | null) => {
    setSelectedStudyIdState(studyId);
    if (studyId) localStorage.setItem(STORAGE_KEY, studyId);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(
    () => ({ selectedStudyId, setSelectedStudyId }),
    [selectedStudyId],
  );

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudyContext() {
  const ctx = useContext(StudyContext);
  if (!ctx) throw new Error("useStudyContext must be used within StudyProvider");
  return ctx;
}
