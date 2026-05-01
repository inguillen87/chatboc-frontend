import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { educationApi } from '@/api/education';
import { useEducationShellData } from '@/hooks/useEducationShellData';

export const useEducationFamilyContext = () => {
  const shellQuery = useEducationShellData('family');
  const familyContextQuery = useQuery({
    queryKey: ['education-family-context'],
    queryFn: () => educationApi.getFamilyContext(),
    retry: 0,
    staleTime: 30_000,
  });
  const familyContext = useMemo(
    () =>
      familyContextQuery.data
        ? { ...shellQuery.data?.family_context, ...familyContextQuery.data }
        : shellQuery.data?.family_context,
    [familyContextQuery.data, shellQuery.data?.family_context],
  );
  const data = useMemo(
    () => (shellQuery.data ? { ...shellQuery.data, family_context: familyContext } : shellQuery.data),
    [familyContext, shellQuery.data],
  );
  const students = useMemo(() => familyContext?.students ?? [], [familyContext?.students]);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const selectedStudent = useMemo(() => {
    if (selectedStudentId) {
      return students.find((student) => student.id === selectedStudentId) ?? null;
    }

    const preselectedId = familyContext?.selected_student_id;
    if (preselectedId) {
      return students.find((student) => student.id === preselectedId) ?? null;
    }

    return students[0] ?? null;
  }, [familyContext?.selected_student_id, selectedStudentId, students]);

  return {
    ...shellQuery,
    data,
    familyContextQuery,
    students,
    selectedStudent,
    selectedStudentId: selectedStudent?.id ?? null,
    setSelectedStudentId,
  };
};
