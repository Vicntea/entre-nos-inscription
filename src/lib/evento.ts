/**
 * Datos del evento que se imprimen en la entrada (ticket) y en el PDF que se
 * descarga al registrarse. Editá estos valores para actualizar lo que ve la
 * persona registrada.
 *
 * La fecha y la ubicación se toman de `src/templates/registro.html`.
 */
export const EVENTO = {
  /** Fecha y hora de la función. */
  fecha: "30 de octubre a las 11:00",
  /** Lugar completo que se muestra en la tarjeta de "Ubicación". */
  lugar: "Cine Club UACh, Campus Isla Teja",
  /** Nombre corto del lugar, usado en el pie del bloque QR. */
  lugarCorto: "Cine Club UACh",
  /** Duración estimada de la obra (editable). */
  duracion: "45-60 min",
  /** Reseña / sinopsis que aparece en la entrada (editable). */
  sinopsis:
    "Legítimas es una obra dramática que aborda distintas experiencias de violencia de género y las formas en que estas se manifiestan, normalizan y perpetúan en la vida cotidiana.A través de las historias de Iris, Antonieta, Gastón y Victoria, la obra transita por experiencias de violencia dentro de la pareja y la familia, violencia sexual, acoso, desigualdad y cuestionamientos sobre el cuerpo y las decisiones de las mujeres. Las experiencias de sus personajes permiten mostrar que la violencia de género no se limita a una única forma ni ocurre exclusivamente en un determinado espacio, sino que puede atravesar diferentes etapas y dimensiones de la vida.La obra confronta también las ideas y discursos que justifican estas violencias, poniendo en tensión aquello que históricamente se ha considerado aceptable, normal o legítimo. Desde el dolor, la rabia y la memoria, Legítimas propone un espacio de reflexión sobre las experiencias de las mujeres y sobre su derecho a contar sus propias historias, decidir sobre sus cuerpos y cuestionar los roles que la sociedad les ha impuesto.",
};

/** Marca de la obra, usada en el encabezado y el ID de la entrada. */
export const LEGITIMAS = {
  /** Prefijo del ID impreso: se le añade un código corto del uuid. */
  idPrefix: "LEG-UACH-2026",
};
