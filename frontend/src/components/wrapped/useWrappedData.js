import { useMemo } from 'react';

/**
 * Hook que procesa datos crudos de memorias, personas y categorías
 * para generar estadísticas visuales para el Wrapped.
 */
export function useWrappedData(memories = [], people = [], categories = [], selfPersonId = null) {
  return useMemo(() => {
    if (!memories.length) {
      return null;
    }

    // ============ PANTALLA 1: Timelapse ============
    const memoriesThisYear = memories.sort(
      (a, b) => new Date(a.memory_date || a.created_at) - new Date(b.memory_date || b.created_at)
    );

    // ============ PANTALLA 2: Primer vs Último ============
    const firstMemory = memoriesThisYear[0] || null;
    const lastMemory = memoriesThisYear[memoriesThisYear.length - 1] || null;

    // ============ PANTALLA 3: Estadísticas ============
    const totalMemories = memories.length;
    const totalPhotos = memories.length; // Asumiendo 1 foto por memoria (ajustar si es necesario)
    
    // Días activos (días únicos con recuerdos)
    const uniqueDates = new Set(
      memories.map(m => {
        const date = new Date(m.memory_date || m.created_at);
        return date.toISOString().split('T')[0];
      })
    );
    const activeDays = uniqueDates.size;
    const avgPerWeek = (totalMemories / 52).toFixed(1);

    // ============ PANTALLA 4: Cloud de Personas ============
    // Usar tagged_people directamente de las memorias (ahora viene del backend)
    const personFrequencyMap = {};
    
    memories.forEach(memory => {
      const taggedPeople = memory.tagged_people || [];
      if (Array.isArray(taggedPeople) && taggedPeople.length) {
        taggedPeople.forEach(personId => {
          personFrequencyMap[personId] = (personFrequencyMap[personId] || 0) + 1;
        });
      }
    });

    // Crear array de personas con frecuencia
    const peopleWithFrequency = people
      .map(p => ({
        ...p,
        frequency: personFrequencyMap[p.id] || 0,
      }))
      .filter(p => p.frequency > 0)
      .sort((a, b) => b.frequency - a.frequency);

    // Generar cloud sin solapamiento (excluir al usuario principal)
    const peopleForCloud = selfPersonId
      ? peopleWithFrequency.filter(p => String(p.id) !== String(selfPersonId))
      : peopleWithFrequency;
    const peopleCloud = generateNonOverlappingPeopleCloud(peopleForCloud);

    // ============ PANTALLA 5: Top Persona ============
    // Excluir al usuario principal por ID (self_person_id del endpoint /me)
    const topPerson = peopleWithFrequency.find(
      p => !selfPersonId || String(p.id) !== String(selfPersonId)
    ) || null;
    const topPersonPhotos = topPerson
      ? memories
          .filter(m => {
            const taggedPeople = m.tagged_people || [];
            return Array.isArray(taggedPeople) && taggedPeople.includes(topPerson.id);
          })
          .slice(0, 15)
          .map(m => ({ id: m.id, url: m.thumbnail_url || m.image_url }))
      : [];

    // ============ PANTALLA 6: Top Categoría ============
    // Usar categories directamente de las memorias (ahora viene del backend)
    const categoryFrequencyMap = {};
    
    memories.forEach(memory => {
      const cats = memory.categories || [];
      
      if (Array.isArray(cats) && cats.length) {
        cats.forEach(cat => {
          const catKey = typeof cat === 'string' ? cat : cat.id || cat.value || cat;
          categoryFrequencyMap[catKey] = (categoryFrequencyMap[catKey] || 0) + 1;
        });
      }
    });

    const categoriesWithFrequency = categories
      .map(c => ({
        ...c,
        frequency: categoryFrequencyMap[c.value] || categoryFrequencyMap[c.id] || 0,
      }))
      .filter(c => c.frequency > 0)
      .sort((a, b) => b.frequency - a.frequency);

    const topCategory = categoriesWithFrequency[0] || null;
    const topCategoryPhotos = topCategory
      ? memories
          .filter(m => {
            const cats = m.categories || [];
            return Array.isArray(cats) && cats.includes(topCategory.value);
          })
          .slice(0, 15)
          .map(m => ({ id: m.id, url: m.thumbnail_url || m.image_url }))
      : [];

    // ============ PANTALLA 7: Ciudades ============
    const citiesMap = {};
    memories.forEach(memory => {
      if (memory.location_name && memory.latitude && memory.longitude) {
        const key = memory.location_name;
        if (!citiesMap[key]) {
          citiesMap[key] = {
            id: key,
            name: memory.location_name,
            country: memory.country || 'Ubicación',
            latitude: memory.latitude,
            longitude: memory.longitude,
            count: 0,
            photos: [],
          };
        }
        citiesMap[key].count++;
        if (citiesMap[key].photos.length < 3) {
          citiesMap[key].photos.push({
            id: memory.id,
            url: memory.thumbnail_url || memory.image_url,
          });
        }
      }
    });

    const cities = Object.values(citiesMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ============ PANTALLA 8: Timeline ============
    const monthsMap = {
      0: 'Enero',
      1: 'Febrero',
      2: 'Marzo',
      3: 'Abril',
      4: 'Mayo',
      5: 'Junio',
      6: 'Julio',
      7: 'Agosto',
      8: 'Septiembre',
      9: 'Octubre',
      10: 'Noviembre',
      11: 'Diciembre',
    };

    const monthCountMap = {};
    memories.forEach(memory => {
      const date = new Date(memory.memory_date || memory.created_at);
      const month = monthsMap[date.getMonth()];
      monthCountMap[month] = (monthCountMap[month] || 0) + 1;
    });

    const timeline = Object.entries(monthsMap)
      .map(([, month]) => ({
        month,
        count: monthCountMap[month] || 0,
      }));

    const maxMonthCount = Math.max(...timeline.map(t => t.count), 1);
    const mostActiveMonth = timeline.reduce((max, current) =>
      current.count > max.count ? current : max
    );

    // Retornar datos procesados
    return {
      // Pantalla 1
      totalMemories,
      memoriesThisYear,

      // Pantalla 2
      firstMemory: firstMemory ? {
        date: new Date(firstMemory.memory_date || firstMemory.created_at),
        image: firstMemory.thumbnail_url || firstMemory.image_url,
        description: firstMemory.description || firstMemory.description_raw || 'Sin descripción',
      } : null,
      lastMemory: lastMemory ? {
        date: new Date(lastMemory.memory_date || lastMemory.created_at),
        image: lastMemory.thumbnail_url || lastMemory.image_url,
        description: lastMemory.description || lastMemory.description_raw || 'Sin descripción',
      } : null,

      // Pantalla 3
      stats: {
        totalMemories,
        totalPhotos,
        activeDays,
        averagePerWeek: parseFloat(avgPerWeek),
      },

      // Pantalla 4
      peopleCloud,
      totalPeople: peopleWithFrequency.length,

      // Pantalla 5
      topPerson: topPerson ? {
        id: topPerson.id,
        name: topPerson.name,
        count: topPerson.frequency,
        mainPhoto: topPersonPhotos[0]?.url || '',
      } : null,
      topPersonMemories: topPersonPhotos.map(p => p.url),

      // Pantalla 6
      topCategory: topCategory ? {
        id: topCategory.id || topCategory.value,
        name: topCategory.label || topCategory.value,
        count: topCategory.frequency,
        mainPhoto: topCategoryPhotos[0]?.url || '',
      } : null,
      topCategoryMemories: topCategoryPhotos.map(p => p.url),

      // Pantalla 7
      cities,

      // Pantalla 8
      timeline,
      maxMonthCount,
      mostActiveMonth: mostActiveMonth.month,
    };
  }, [memories, people, categories]);
}

/**
 * Genera posiciones de personas para el cloud sin solapamiento.
 * Nombres en -5°, 0°, +5° (vertical/horizontal)
 */
function generateNonOverlappingPeopleCloud(people) {
  if (!people.length) return [];

  const containerWidth = 800; // Ajustar según pantalla
  const containerHeight = 600;
  const gridSize = 120; // Tamaño de celda en grid invisible
  const minFontSize = 14;
  const maxFontSize = 36;

  // Calcular tamaño de fuente basado en frecuencia
  const maxFreq = Math.max(...people.map(p => p.frequency));
  const minFreq = Math.min(...people.map(p => p.frequency));

  const positions = [];
  const usedCells = new Set();

  // Generar grid de celdas disponibles
  const cells = [];
  for (let y = 0; y < containerHeight; y += gridSize) {
    for (let x = 0; x < containerWidth; x += gridSize) {
      cells.push({ x, y, available: true });
    }
  }

  // Colocar cada persona
  people.forEach((person, index) => {
    // Encontrar celda disponible
    const availableCell = cells.find(c => c.available);
    if (!availableCell) return;

    availableCell.available = false;
    usedCells.add(availableCell);

    // Calcular tamaño proporcional a frecuencia (0-3 para el componente visual)
    const sizeIndex = Math.min(
      3,
      Math.floor(
        ((person.frequency - minFreq) / (maxFreq - minFreq + 1)) * 4
      )
    );

    // Rotación aleatoria: -5, 0, +5
    const rotations = [-5, 0, 5];
    const rotation = rotations[Math.floor(Math.random() * rotations.length)];

    // Normalizar posiciones a 0-1
    const x = availableCell.x / containerWidth;
    const y = availableCell.y / containerHeight;

    positions.push({
      id: person.id || `person-${index}`,
      name: person.name,
      frequency: person.frequency,
      x: Math.max(0.05, Math.min(0.95, x)),
      y: Math.max(0.05, Math.min(0.95, y)),
      size: sizeIndex,
      rotation,
    });
  });

  return positions;
}
