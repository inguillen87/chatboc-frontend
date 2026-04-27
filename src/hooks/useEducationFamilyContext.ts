import { useMemo, useState } from 'react';
import { useEducationShellData } from '@/hooks/useEducationShellData';

export const useEducationFamilyContext = () => {
  const shellQuery = useEducationShellData('family');
  const students = useMemo(() => shellQuery.data?.family_context?.students ?? [], [shellQuery.data?.family_context?.students]);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const selectedStudent = useMemo(() => {
    if (selectedStudentId) {
      return students.find((student) => student.id === selectedStudentId) ?? null;
    }

    const preselectedId = shellQuery.data?.family_context?.selected_student_id;
    if (preselectedId) {
      return students.find((student) => student.id === preselectedId) ?? null;
    }

    return students[0] ?? null;
  }, [selectedStudentId, shellQuery.data?.family_context?.selected_student_id, students]);

  return {
    ...shellQuery,
    students,
    selectedStudent,
    selectedStudentId: selectedStudent?.id ?? null,
    setSelectedStudentId,
  };
};
