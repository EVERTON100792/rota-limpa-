import { Stop } from '../types';
import Fuse from 'fuse.js';
import { fetchViaCep, extractCepAndNumber } from './viacepService';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// List of major Brazilian cities to help with fuzzy matching
const BRAZILIAN_CITIES = [
  "São Paulo, SP", "Rio de Janeiro, RJ", "Brasília, DF", "Salvador, BA", "Fortaleza, CE",
  "Belo Horizonte, MG", "Manaus, AM", "Curitiba, PR", "Recife, PE", "Goiânia, GO",
  "Belém, PA", "Porto Alegre, RS", "Guarulhos, SP", "Campinas, SP", "São Luís, MA",
  "São Gonçalo, RJ", "Maceió, AL", "Duque de Caxias, RJ", "Natal, RN", "Teresina, PI",
  "São Bernardo do Campo, SP", "Nova Iguaçu, RJ", "Campo Grande, MS", "João Pessoa, PB",
  "Santo André, SP", "São José dos Campos, SP", "Jaboatão dos Guararapes, PE", "Osasco, SP",
  "Ribeirão Preto, SP", "Uberlândia, MG", "Sorocaba, SP", "Contagem, MG", "Aracaju, SE",
  "Feira de Santana, BA", "Cuiabá, MT", "Joinville, SC", "Juiz de Fora, MG", "Londrina, PR",
  "Aparecida de Goiânia, GO", "Ananindeua, PA", "Porto Velho, RO", "Serra, ES", "Niterói, RJ",
  "Belford Roxo, RJ", "Caxias do Sul, RS", "Campos dos Goytacazes, RJ", "Macapá, AP",
  "Florianópolis, SC", "Vila Velha, ES", "Mauá, SP", "São João de Meriti, RJ", "São José do Rio Preto, SP",
  "Mogi das Cruzes, SP", "Betim, MG", "Santos, SP", "Diadema, SP", "Maringá, PR", "Jundiaí, SP",
  "Campina Grande, PB", "Montes Claros, MG", "Rio Branco, AC", "Piracicaba, SP", "Carapicuíba, SP",
  "Olinda, PE", "Anápolis, GO", "Cariacica, ES", "Bauru, SP", "Itaquaquecetuba, SP", "São Vicente, SP",
  "Vitória, ES", "Caruaru, PE", "Caucaia, CE", "Blumenau, SC", "Franca, SP", "Ponta Grossa, PR",
  "Canoas, RS", "Petrolina, PE", "Pelotas, RS", "Vitória da Conquista, BA", "Ribeirão das Neves, MG",
  "Uberaba, MG", "Paulista, PE", "Cascavel, PR", "Praia Grande, SP", "São José dos Pinhais, PR",
  "Dourado, SP", "Douradina, PR", "Douradina, MS", "Umuarama, PR", "Maringá, PR", "Londrina, PR",
  "Cascavel, PR", "Toledo, PR", "Ponta Grossa, PR", "Guarapuava, PR", "Foz do Iguaçu, PR",
  "Apucarana, PR", "Arapongas, PR", "Campo Mourão, PR", "Paranavaí, PR", "Pato Branco, PR",
  "Francisco Beltrão, PR", "Cianorte, PR", "Telêmaco Borba, PR", "Castro, PR", "Rolândia, PR",
  "Irati, PR", "União da Vitória, PR", "Ibiporã, PR", "Marechal Cândido Rondon, PR",
  "Prudentópolis, PR", "Palmas, PR", "Cornélio Procópio, PR", "Medianeira, PR", "Santo Antônio da Platina, PR",
  "Jacarezinho, PR", "Dois Vizinhos, PR", "Assis Chateaubriand, PR", "Laranjeiras do Sul, PR",
  "Guaíra, PR", "Bandeirantes, PR", "Piraquara, PR", "Colombo, PR", "Pinhais, PR", "Araucária, PR",
  "Fazenda Rio Grande, PR", "Almirante Tamandaré, PR", "Campo Largo, PR", "São José dos Pinhais, PR",
  "Suzano, SP", "Mossoró, RN", "Taboão da Serra, SP", "Sumaré, SP",
  "Palmas, TO", "Santa Maria, RS", "Gravataí, RS", "Governador Valadares, MG", "Barueri, SP",
  "Embu das Artes, SP", "Juazeiro do Norte, CE", "Ipatinga, MG", "Parnamirim, RN", "Imperatriz, MA",
  "Foz do Iguaçu, PR", "Viamão, RS", "Macaé, RJ", "São Carlos, SP", "Indaiatuba, SP", "Cotia, SP",
  "Novo Hamburgo, RS", "Araraquara, SP", "Magé, RJ", "Itabuna, BA", "Sete Lagoas, MG", "Marília, SP",
  "Sertãozinho, SP", "Itaboraí, RJ", "Americana, SP", "Itapevi, SP", "São Leopoldo, RS", "Jacareí, SP",
  "Presidente Prudente, SP", "Araxá, MG", "Passo Fundo, RS", "Rondonópolis, MT", "Castanhal, PA",
  "Divinópolis, MG", "Poços de Caldas, MG", "Santa Luzia, MG", "Juazeiro, BA", "Cabo Frio, RJ",
  "Águas Lindas de Goiás, GO", "Cachoeiro de Itapemirim, ES", "Rio Grande, RS", "Alvorada, RS",
  "Sobral, CE", "Luziânia, GO", "Parauapebas, PA", "Rio Verde, GO", "Angra dos Reis, RJ", "Muriaé, MG",
  "Valparaíso de Goiás, GO", "Teresópolis, RJ", "Mesquita, RJ", "Barreiras, BA", "Cabo de Santo Agostinho, PE",
  "Santana de Parnaíba, SP", "Araras, SP", "Hortolândia, SP", "Ribeirão Pires, SP", "Catanduva, SP",
  "Bento Gonçalves, RS", "Bagé, RS", "Uruguaiana, RS", "Erechim, RS", "Lajeado, RS", "Ijuí, RS",
  "Santa Cruz do Sul, RS", "Cachoeirinha, RS", "Guaíba, RS", "Sapucaia do Sul, RS", "Esteio, RS",
  "Viamão, RS", "Novo Hamburgo, RS", "São Leopoldo, RS", "Canoas, RS", "Porto Alegre, RS"
];

const fuse = new Fuse(BRAZILIAN_CITIES, {
  includeScore: true,
  threshold: 0.5, // Allow more fuzzy for city names
});

/**
 * Local address correction using fuzzy matching
 */
export const correctAddressLocally = (address: string): string => {
  const addressLower = address.toLowerCase().trim();

  // If it's very short, don't try to correct
  if (addressLower.length < 3) return address;

  // Special case: if it's a known city name with a typo
  const results = fuse.search(address);

  if (results.length > 0 && results[0].score! < 0.45) {
    const match = results[0].item;

    // If the match is a city and the input is just one or two words, 
    // it's highly likely they want the city.
    const wordCount = addressLower.split(/\s+/).length;
    if (wordCount <= 2 || results[0].score! < 0.25) {
      console.log(`Local Fuzzy Correction (City Priority): "${address}" -> "${match}" (Score: ${results[0].score})`);
      return match;
    }
  }

  return address;
};

/**
 * Local Smart Parser to clean and normalize messy address strings without needing an API Key.
 */
export const normalizeAddresses = async (rawText: string): Promise<{ original: string, clean: string }[]> => {
  const addresses: { original: string, clean: string }[] = [];

  // 1. Check for "Ordem de Montagem" or structured format (key-value pairs)
  if (/Endere[cç]o[\.\s]*:/i.test(rawText)) {
    // Split by Razao Social or Endereco to handle multiple orders pasted at once
    const blocks = rawText.split(/(?=Raz[aã]o Social[\.\s]*:|Endere[cç]o[\.\s]*:)/i);

    for (const block of blocks) {
      if (!/Endere[cç]o[\.\s]*:/i.test(block)) continue;

      // Use a lookahead to stop at 2+ spaces, tabs, newlines, or other known keys
      const stopPattern = '(?=\\s{2,}|\\t|Bairro[\\.\\s]*:|Cep[\\.\\s]*:|Estado[\\.\\s]*:|Cidade[\\.\\s]*:|Cgc[\\.\\s]*:|Inscri[cç][aã]o[\\.\\s]*:|End\\. Entrega[\\.\\s]*:|\\n|\\r|$)';

      const enderecoMatch = block.match(new RegExp(`Endere[cç]o[\\.\\s]*:\\s*(.+?)${stopPattern}`, 'i'));
      const cidadeMatch = block.match(new RegExp(`Cidade[\\.\\s]*:\\s*(.+?)${stopPattern}`, 'i'));
      const bairroMatch = block.match(new RegExp(`Bairro[\\.\\s]*:\\s*(.+?)${stopPattern}`, 'i'));
      const estadoMatch = block.match(new RegExp(`Estado[\\.\\s]*:\\s*(.+?)${stopPattern}`, 'i'));
      const cepMatch = block.match(new RegExp(`Cep[\\.\\s]*:\\s*(.+?)${stopPattern}`, 'i'));

      if (enderecoMatch) {
        let endereco = enderecoMatch[1].trim();
        let cidade = cidadeMatch ? cidadeMatch[1].trim() : '';
        let bairro = bairroMatch ? bairroMatch[1].trim() : '';
        let estado = estadoMatch ? estadoMatch[1].trim() : '';

        // If End. Entrega is present and not empty, it might override the main address
        const endEntregaMatch = block.match(new RegExp(`End\\. Entrega[\\.\\s]*:\\s*(.+?)${stopPattern}`, 'i'));
        if (endEntregaMatch && endEntregaMatch[1].trim().length > 3) {
          endereco = endEntregaMatch[1].trim();
          // Try to find the second Cidade if it exists
          const allCidades = [...block.matchAll(new RegExp(`Cidade[\\.\\s]*:\\s*(.+?)${stopPattern}`, 'gi'))];
          if (allCidades.length > 1 && allCidades[1][1].trim().length > 0) {
            cidade = allCidades[1][1].trim();
          }
        }

        if (endereco) {
          // If a CEP was found explicitly in the block or inside the address, try ViaCEP
          let viaCepData = null;
          let cepToUse = cepMatch ? cepMatch[1].trim() : null;
          let numberToUse = '';

          // Find number in address if no explicit number block exists
          const extract = extractCepAndNumber(endereco);
          if (!cepToUse && extract.cep) {
            cepToUse = extract.cep;
          }
          if (extract.number) {
            numberToUse = extract.number;
          } else {
            // Try to regex just the number from the street string
            const firstCommaMatch = endereco.match(/,\s*(\d+[A-Za-z]?)/);
            if (firstCommaMatch) numberToUse = firstCommaMatch[1];
          }

          if (cepToUse) {
            // Wait slightly so we don't spam ViaCEP
            if (addresses.length > 0) await new Promise(res => setTimeout(res, 300));
            viaCepData = await fetchViaCep(cepToUse);

            if (viaCepData && !viaCepData.erro) {
              // Assemble perfect address using ViaCEP data, ignoring empty fields
              const parts = [
                viaCepData.logradouro,
                numberToUse ? numberToUse : '',
                viaCepData.bairro,
                viaCepData.localidade,
                viaCepData.uf
              ].filter(p => p && p.trim().length > 0);

              const cleanAddress = parts.join(', ').trim();
              addresses.push({
                original: cleanAddress, // Overwrite original so it looks cleaner
                clean: cleanAddress
              });
              continue; // Move to next order block
            }
          }

          const cleanParts = [endereco, bairro, cidade, estado].filter(Boolean);
          const cleanAddress = cleanParts.join(', ');

          addresses.push({
            original: cleanAddress, // Use the assembled address as original so it looks good in UI
            clean: cleanAddress
          });
        }
      }
    }

    if (addresses.length > 0) {
      return addresses;
    }
  }

  // 2. Fallback to standard line-by-line list parsing
  const lines = rawText
    .split(/\n|;|•|(?:\d+\. )/)
    .map(l => l.trim())
    .filter(l => l.length > 3);

  // Need to loop async to support ViaCEP delays
  const finalAddresses: { original: string, clean: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Basic cleaning: remove common "noise" words at the start
    let clean = line
      .replace(/^(?:endereço|entrega|ponto|parada|local|rua|av|avenida|travessa|alameda)[:\s-]+\s*/i, '')
      .trim();

    // VIA-CEP ENHANCEMENT
    const { cep, number } = extractCepAndNumber(clean);

    if (cep) {
      if (i > 0) await new Promise(res => setTimeout(res, 300));
      const viaCepData = await fetchViaCep(cep);

      if (viaCepData && !viaCepData.erro) {
        // Build perfect via CEP address
        let numStr = number ? number : '';
        // If we didn't extract a number, check if the original line has some digits that could be the number
        if (!number) {
          const possibleNum = clean.replace(cep, '').match(/(?:\b|,\s*|\s+)(\d+[A-Za-z]?)\b/);
          if (possibleNum) {
            numStr = possibleNum[1];
          }
        }

        const parts = [
          viaCepData.logradouro,
          numStr,
          viaCepData.bairro,
          viaCepData.localidade,
          viaCepData.uf
        ].filter(p => p && p.trim().length > 0);

        const perfectAddress = parts.join(', ').trim();
        finalAddresses.push({
          original: perfectAddress,
          clean: perfectAddress
        });
        continue;
      }
    }

    finalAddresses.push({
      original: line,
      clean: clean || line
    });
  }

  return finalAddresses;
};

/**
 * Geocoding Service with Google Maps fallback and Nominatim as secondary
 */
export const geocodeAddress = async (address: string, biasLat?: number, biasLng?: number): Promise<Partial<Stop> | null> => {
  let currentAddress = address;

  // Heuristic to determine if the query is likely a city name vs a specific street address
  const addressLower = currentAddress.toLowerCase().trim();
  const hasNumber = /\d/.test(addressLower);
  const hasStreetPrefix = /^(rua|r\.|r\s|av\.|av\s|avenida|travessa|alameda|rodovia|rod\.|rod\s|br-|pr-|sp-|mg-|rs-|sc-|pra[cç]a|p[cç]a|largo|estrada|estr\.|estr\s|via|viela|beco|servid[aã]o)/i.test(addressLower);
  const wordCount = addressLower.split(/\s+/).length;

  // If it looks like it might have a typo (short, no number, no prefix), try local fuzzy correction first
  if (!hasNumber && !hasStreetPrefix && wordCount <= 2) {
    const corrected = correctAddressLocally(address);
    if (corrected !== address) {
      currentAddress = corrected;
    }
  }

  const isLikelyCity = !hasStreetPrefix && !hasNumber && wordCount <= 2;

  // Try Google Maps first if key is available
  if (GOOGLE_MAPS_API_KEY) {
    try {
      // If it's likely a city, we add locality type hint
      let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(currentAddress)}&key=${GOOGLE_MAPS_API_KEY}&language=pt-BR&components=country:BR`;

      if (isLikelyCity) {
        url += '&types=(cities)';
      }

      if (biasLat && biasLng) {
        const offset = isLikelyCity ? 5.0 : 0.5;
        url += `&bounds=${biasLat - offset},${biasLng - offset}|${biasLat + offset},${biasLng + offset}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'OK' && data.results.length > 0) {
        let validResults = data.results;

        if (isLikelyCity) {
          // Filter out street results if we suspect it's a city query
          const nonStreetResults = data.results.filter((r: any) => !r.types.includes('route'));
          if (nonStreetResults.length > 0) {
            validResults = nonStreetResults;
          }
        }

        let result = validResults[0];

        if (isLikelyCity) {
          // Try to find a result that is a city/locality
          const cityResult = validResults.find((r: any) =>
            r.types.includes('locality') ||
            r.types.includes('administrative_area_level_2') ||
            r.types.includes('administrative_area_level_1')
          );
          if (cityResult) {
            result = cityResult;
          }
        }

        return {
          address: result.formatted_address, // Use the official formatted address from Google
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng
        };
      }
    } catch (error) {
      console.error('Google Geocoding Error:', error);
    }
  }

  console.log(`Attempting to geocode: ${currentAddress}`);

  // Expand abbreviations to help Nominatim
  const expandAbbreviations = (addr: string) => {
    let expanded = addr
      .replace(/\bR\.\s*/gi, 'Rua ')
      .replace(/\bAv\.\s*/gi, 'Avenida ')
      .replace(/\bDr\.\s*/gi, 'Doutor ')
      .replace(/\bProf\.\s*/gi, 'Professor ')
      .replace(/\bJd\.\s*/gi, 'Jardim ')
      .replace(/\bSt\.\s*/gi, 'Santa ')
      .replace(/\bSto\.\s*/gi, 'Santo ')
      .replace(/\bVl\.\s*/gi, 'Vila ')
      .replace(/\bPq\.\s*/gi, 'Parque ')
      // Common typos
      .replace(/\bTua\b/gi, 'Rua')
      .replace(/\bRu\b/gi, 'Rua')
      .replace(/\bAvanida\b/gi, 'Avenida')
      .replace(/\bAv\b(?!\.)/gi, 'Avenida');

    // Handle "Rua X Bandeirantes" or "Rua X São Paulo" by adding a comma before the last word(s) if missing
    // This helps Nominatim understand that the last part is a city/state
    const parts = expanded.split(/\s+/);
    if (parts.length > 2 && !expanded.includes(',') && !expanded.includes('-')) {
      // Check if the last word or last two words look like a city/state
      const lastWord = parts[parts.length - 1].toLowerCase();
      const lastTwoWords = parts.slice(-2).join(' ').toLowerCase();

      const knownStates = ['parana', 'paraná', 'pr', 'sao paulo', 'são paulo', 'sp', 'minas gerais', 'mg', 'rio de janeiro', 'rj', 'santa catarina', 'sc', 'rio grande do sul', 'rs'];

      if (knownStates.includes(lastWord) || knownStates.includes(lastTwoWords)) {
        // It's a state, add comma before it
        const stateLen = knownStates.includes(lastTwoWords) ? 2 : 1;
        expanded = parts.slice(0, -stateLen).join(' ') + ', ' + parts.slice(-stateLen).join(' ');
      } else {
        // Assume the last word is a city if there's no number at the end
        if (!/\d/.test(lastWord)) {
          expanded = parts.slice(0, -1).join(' ') + ', ' + parts[parts.length - 1];
        }
      }
    }
    return expanded;
  };

  const cleanAddress = expandAbbreviations(currentAddress);

  // Fallback to Nominatim
  const fetchFromNominatim = async (query: string) => {
    console.log(`Trying Nominatim for: ${query}`);
    const fullQuery = query.toLowerCase().includes('brasil') ? query : `${query}, Brasil`;

    // Increase limit to 15 if we suspect it's a city, to ensure we find it even if there are many streets
    const limit = isLikelyCity ? 15 : 5;
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=${limit}`;

    if (isLikelyCity) {
      url += '&featuretype=settlement'; // Explicitly ask for cities/towns
    }

    let offset = 0.5; // Default 50km viewbox for local streets

    if (isLikelyCity) {
      offset = 5.0; // 500km viewbox for cities/regions to prevent local streets from overriding them
    }

    if (biasLat && biasLng) {
      url += `&viewbox=${biasLng - offset},${biasLat + offset},${biasLng + offset},${biasLat - offset}&bounded=0`;
    }

    try {
      // Add a small delay to respect Nominatim's 1 request/sec policy during retries
      await sleep(1000);

      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'pt-BR'
        }
      });
      if (!response.ok) {
        console.log(`Nominatim request failed for ${query}: ${response.statusText}`);
        return null;
      }
      const data = await response.json();
      if (data && data.length > 0) {
        let validResults = data;

        if (isLikelyCity) {
          // Filter out street results if we suspect it's a city query
          const nonStreetResults = data.filter((d: any) => d.class !== 'highway');
          if (nonStreetResults.length > 0) {
            validResults = nonStreetResults;
          }
        }

        // If we suspect it's a city query, explicitly look for a city/town result
        if (isLikelyCity) {
          const cityResult = validResults.find((d: any) =>
            d.type === 'city' ||
            d.type === 'administrative' ||
            d.type === 'town' ||
            d.type === 'municipality' ||
            d.class === 'boundary'
          );
          if (cityResult) {
            console.log(`Nominatim found city: ${cityResult.display_name} (${cityResult.lat}, ${cityResult.lon})`);
            return cityResult;
          }
        }

        console.log(`Nominatim found: ${validResults[0].display_name} (${validResults[0].lat}, ${validResults[0].lon})`);
        return validResults[0];
      } else {
        console.log(`Nominatim found no results for: ${query}`);
        return null;
      }
    } catch (e) {
      console.log('Nominatim request failed (network error)');
      return null;
    }
  };

  // Fallback to Photon (better fuzzy matching than Nominatim)
  const fetchFromPhoton = async (query: string) => {
    console.log(`Trying Photon for: ${query}`);
    const fullQuery = query.toLowerCase().includes('brasil') ? query : `${query}, Brasil`;

    const limit = isLikelyCity ? 10 : 5;
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(fullQuery)}&limit=${limit}`;
    if (biasLat && biasLng) {
      url += `&lat=${biasLat}&lon=${biasLng}`; // Photon location bias
    }

    try {
      await sleep(500); // Small delay for Photon too
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      if (data && data.features && data.features.length > 0) {
        let validFeatures = data.features;

        if (isLikelyCity) {
          // Filter out street results if we suspect it's a city query
          const nonStreetFeatures = data.features.filter((f: any) => f.properties.osm_key !== 'highway');
          if (nonStreetFeatures.length > 0) {
            validFeatures = nonStreetFeatures;
          }
        }

        let feature = validFeatures[0];

        if (isLikelyCity) {
          const cityFeature = validFeatures.find((f: any) =>
            f.properties.osm_value === 'city' ||
            f.properties.osm_value === 'town' ||
            f.properties.osm_value === 'administrative' ||
            f.properties.osm_value === 'municipality'
          );
          if (cityFeature) {
            feature = cityFeature;
          }
        }

        const [lon, lat] = feature.geometry.coordinates;
        const props = feature.properties;
        const displayName = [props.name, props.street, props.city, props.state].filter(Boolean).join(', ');
        console.log(`Photon found: ${displayName} (${lat}, ${lon})`);
        return {
          display_name: displayName,
          lat: lat,
          lon: lon
        };
      }
    } catch (e) {
      console.log('Photon request failed (network error)');
    }
    return null;
  };

  try {
    // 1. Try exact address first (most accurate for numbers)
    let data = await fetchFromNominatim(cleanAddress);

    // 2. If Nominatim fails, try Photon (excellent fuzzy matching)
    if (!data) {
      data = await fetchFromPhoton(cleanAddress);
    }

    // 3. If failed and has a dash, try removing the part after the dash (common in Brazil for "Rua X - Bairro Y")
    if (!data && cleanAddress.includes('-')) {
      const parts = cleanAddress.split('-');
      console.log(`Nominatim: Retrying without dash for: ${parts[0].trim()}`);
      data = await fetchFromNominatim(parts[0].trim());
      if (!data) data = await fetchFromPhoton(parts[0].trim());
    }

    // 4. If failed, try removing the number entirely (Nominatim often fails if number is unmapped)
    if (!data) {
      const noNumber = cleanAddress.replace(/,\s*\d+.*$/, '').replace(/\s+\d+\s*$/, '');
      if (noNumber !== cleanAddress) {
        console.log(`Nominatim: Retrying without number for: ${noNumber}`);
        data = await fetchFromNominatim(noNumber);
        if (!data) data = await fetchFromPhoton(noNumber);
      }
    }

    // 5. If still failed, try a very fuzzy search (removing street types)
    if (!data) {
      const fuzzy = cleanAddress.replace(/^(?:rua|tua|ru|av|avenida|travessa|alameda)\s+/i, '');
      if (fuzzy !== cleanAddress) {
        console.log(`Nominatim: Retrying fuzzy search for: ${fuzzy}`);
        data = await fetchFromNominatim(fuzzy);
        if (!data) data = await fetchFromPhoton(fuzzy);
      }
    }

    // 6. If everything failed and we haven't tried local correction yet, try it now as a last resort
    if (!data && currentAddress === address) {
      const localCorrected = correctAddressLocally(address);
      if (localCorrected !== address) {
        console.log(`Last resort local correction: ${localCorrected}`);
        data = await fetchFromNominatim(localCorrected);
        if (!data) data = await fetchFromPhoton(localCorrected);
      }
    }

    if (data) {
      return {
        address: data.display_name,
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon)
      };
    }
    console.warn(`Geocoding failed for: ${address}`);
    return null;
  } catch (error) {
    console.error('Nominatim Geocoding Error:', error);
    return null;
  }
};

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
