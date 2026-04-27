import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EducationShell from '@/components/education/EducationShell';
import { useEducationFamilyContext } from '@/hooks/useEducationFamilyContext';

export default function EducationFamilyHomePage() {
  const { data, students, selectedStudentId, selectedStudent, setSelectedStudentId } = useEducationFamilyContext();

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
            {(data?.quick_actions ?? []).length === 0 ? (
              <p>El backend todavía no publicó acciones para este perfil.</p>
            ) : (
              <ul className="list-disc pl-4">
                {data?.quick_actions?.map((action) => (
                  <li key={action.id}>{action.label}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/educacion/familia/asistencia">Asistencia</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/educacion/familia/documentos">Documentos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </EducationShell>
  );
}
