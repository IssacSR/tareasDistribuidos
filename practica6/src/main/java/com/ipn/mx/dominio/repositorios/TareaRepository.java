package com.ipn.mx.dominio.repositorios;

import com.ipn.mx.dominio.entidades.Tarea;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TareaRepository extends JpaRepository<Tarea, Long> {
    List<Tarea> findByOwnerId(Long ownerId);

    List<Tarea> findByCompletada(Boolean completada);

    List<Tarea> findByTituloContainingIgnoreCase(String texto);
}