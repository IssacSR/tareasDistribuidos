package com.ipn.mx.dominio.repositorios;

import com.ipn.mx.dominio.entidades.Tarea;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TareaRepository extends JpaRepository<Tarea, Long> {
    // Buscar tareas por el id del propietario (owner)
    List<Tarea> findByOwnerId(Long ownerId);

    // Filtrar por estado completada
    List<Tarea> findByCompletada(Boolean completada);

    // Búsqueda por fragmento de título (ignore case)
    List<Tarea> findByTituloContainingIgnoreCase(String texto);
}