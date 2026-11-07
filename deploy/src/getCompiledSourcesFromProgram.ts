import type ts from 'typescript';
import type { Sources } from './Sources.ts';

export function getCompiledSourcesFromProgram(program: ts.EmitAndSemanticDiagnosticsBuilderProgram): Sources {
  const data: Sources = [];

  // Grab all the compiled sources
  program.emit(undefined, (filename, source) => data.push({ filename, source }));

  return data;
}
