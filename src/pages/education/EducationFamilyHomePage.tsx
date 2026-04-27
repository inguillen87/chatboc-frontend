import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EducationShell from '@/components/education/EducationShell';
import { useEducationFamilyContext } from '@/hooks/useEducationFamilyContext';
import { EDUCATION_FEATURE_FLAGS } from '@/config/featureFlags';

const isQuickActionPathEnabled = (path: string) => {
  if (path === '/educacion/familia/asistencia') return EDUCATION_FEATURE_FLAGS.attendance_enabled;
  if (path === '/educacion/familia/documentos') return EDUCATION_FEATURE_FLAGS.documents_enabled;
  return true;
};

export default function EducationFamilyHomePage() {
  const { data, students, selectedStudentId, selectedStudent, setSelectedStudentId } = useEducationFamilyContext();
  const backendQuickActions = (data?.quick_actions ?? []).filter((action) => isQuickActionPathEnabled(action.path));

  return (
    <EducationShell persona="family">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contexto familiar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Estado de verificación: {data?.family_context?.verification_state ?? 'known'}</p>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground" htmlFor="student-switcher">
                Alumno activo
              </label>
              <select
                id="student-switcher"
                className="w-full rounded-md border bg-background px-3 py-2"
                value={selectedStudentId ?? ''}
                onChange={(event) => setSelectedStudentId(event.target.value || null)}
              >
                {students.length === 0 ? <option value="">Sin alumnos vinculados</option> : null}
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                  </option>
                ))}
              </select>
            </div>
            {selectedStudent?.course_label ? (
              <p className="text-muted-foreground">Curso/división: {selectedStudent.course_label}</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {backendQuickActions.length === 0 ? (
              <p>El backend todavía no publicó acciones para este perfil.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {backendQuickActions.map((action) => (
                  <Button asChild size="sm" variant="outline" key={action.id}>
                    <Link to={action.path}>{action.label}</Link>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </EducationShell>
  );
}
