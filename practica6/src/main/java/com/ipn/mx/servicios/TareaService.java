package com.ipn.mx.servicios;

import com.ipn.mx.dominio.entidades.Tarea;

import java.util.List;

public interface TareaService {
    Tarea save(Tarea tarea);
    Tarea read(Long id);
    List<Tarea> readAll();
    void delete(Long id);

    // Operaciones útiles adicionales
    List<Tarea> findByOwnerId(Long ownerId);
    Tarea setCompletada(Long id, boolean completada);
}