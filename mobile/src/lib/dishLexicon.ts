import { FoodTag, MealSlot } from './taxonomy';

/**
 * Curated dish lexicon.
 *
 * Most dish names in the 195-country atlas are local names that carry no
 * English keyword — "Thieboudienne" is a fish and rice dish, but nothing in the
 * string says so. This lexicon adds what is genuinely known about widely
 * documented dishes.
 *
 * Strict rules:
 *   - It adds *tags* and, occasionally, a meal slot. Nothing else.
 *   - It never adds ingredients, quantities, method, nutrition or a claim of
 *     authenticity. A discovery record stays a discovery record.
 *   - A dish only appears here when its principal component is well documented.
 *     Anything uncertain is left out, and stays untagged rather than guessed.
 *
 * Tags from this table are still marked as inferred on the record, because they
 * describe the dish in general rather than a specific verified preparation.
 */
export type LexiconEntry = {
  match: RegExp;
  tags: FoodTag[];
  slots?: MealSlot[];
};

export const DISH_LEXICON: LexiconEntry[] = [
  // Dumplings, pastries and filled breads
  { match: /\b(mantu|manti|buuz|khuushuur|momo|khinkali|pelmeni|vareniki|pierogi|kreplach|gyoza|jiaozi)\b/i, tags: ['meat', 'comforting', 'bread'] },
  { match: /\bashak\b/i, tags: ['plant based', 'comforting'] },
  { match: /\b(banitsa|burek|börek|byrek|banisa|pastizzi|placinta|plăcintă|kibinai|barbagiuàn|salteñas|empanada|empanadas|samsa|sambusa|fatayer)\b/i, tags: ['bread', 'baked', 'street food'] },
  { match: /\b(cepelinai|draniki|gromperekichelcher|kartoffel|rösti|latke)\b/i, tags: ['plant based', 'comforting'] },

  // Fish and seafood
  { match: /\b(thieboudienne|thiéboudienne|moqueca|mohinga|garudhiya|aljotta|hilsa|ilish|saltfish|bacalao|bacalhau|mas huni|fihunu mas|chambo|mukeke|hudut|stocafi|surmai|machli|balik|riba|psari|pescado|escabeche|escovitch|matapa|kokoda|oka|palusami i'a|sup ikan|otak-otak)\b/i, tags: ['fish'] },
  { match: /\b(moules|conch|langouste|calamari|gambas|camarão|crevette|prawn|kelaguen)\b/i, tags: ['shellfish'] },
  { match: /\b(machboos|majboos|kabsa|mandi|zurbian)\b/i, tags: ['rice', 'meat'] },

  // Meat led
  { match: /\b(khorovats|ćevapi|cevapi|pljeskavica|seswaa|njeguški|pršut|kavarma|silpancho|cochinita|pastor|churrasco|asado|braai|shashlik|shish|souvlaki|gyros|doner|döner|schnitzel|goulash|guláš|gulyás|carbonnade|bigos|feijoada|puchero|locro|karniyarik|kleftiko|stifado|rendang|adobo|lechon|lechón|bulgogi|galbi|jollof with beef|nyama choma|sate|satay|kofta|kefta|kibbeh|shawarma|suya|biltong|potjiekos|mici|mititei|leberkäse|currywurst|bratwurst|frikadeller|smalahove|fårikål|pinnekjøtt|kjøttkaker|köttbullar|lahmacun|khash|hafalaab|tô with meat)\b/i, tags: ['meat'] },
  { match: /\b(phaksha paa|judd mat|jamón|jamon|prosciutto|speck|bacon|chorizo|morcilla)\b/i, tags: ['meat'] },
  { match: /\b(jasha maru|doro wat|yassa|poulet|kyckling|kai yang|inasal|piri piri chicken|peri peri chicken|hainanese|karaage|katsu|coq au vin)\b/i, tags: ['chicken'] },

  // Plant led staples and vegetable dishes
  { match: /\b(funje|fufu|foufou|ugali|nshima|nsima|sadza|bogobe|xima|papa|pap|banku|kenkey|akple|tô|to\b|mămăligă|mamaliga|polenta|kačamak|cicvara|ribel|ambuyat|breadfruit|taro|cassava|manioc|yam|plantain|matoke|matooke|mofo gasy|arepas?|pupusa|tamale|tortilla)\b/i, tags: ['plant based', 'comforting'] },
  { match: /\b(morogo|ndiwo|chakalaka|palava|sukuma|callaloo|efo riro|ewedu|molokhia|mulukhiyah|horta|zeamă|motoho|ravitoto|laing)\b/i, tags: ['plant based'] },
  { match: /\b(mujaddara|koshari|kushari|dal|dhal|daal|adasi|ful medames|foul|lobio|ghormeh|khoresh|imam bayildi|dolma|dolmades|sarma|yaprak|gigantes|fasolia|ibiharage|cachupa|githeri|irio|matapa de amendoim)\b/i, tags: ['plant based', 'high fibre'] },
  { match: /\b(ema datshi|käsespätzle|käsknöpfle|kaeserei|raclette|fondue|halloumi|saganaki|wagasi|paneer|tiroler gröstl|trinxat|escudella)\b/i, tags: ['vegetarian', 'comforting'] },
  { match: /\b(gado-gado|gado gado|kachumbari|som tam|shirazi|fattoush|tabbouleh|tabouleh|horiatiki|olivier|salade|salat|zaalouk)\b/i, tags: ['salad', 'light'] },

  // Soups and stews
  { match: /\b(begova čorba|čorba|chorba|shorba|harira|canja|romazava|hafaloa|šaltibarščiai|saltibarsciai|borscht|borsch|zeama|sopa|caldo|potaje|bouillabaisse|waterzooi|solyanka|shchi|tom yum|sinigang|bulalo|kharcho|piti|bozbash|dovga|ayran soup|tarhana|yayla|menudo|pozole|sancocho|ajiaco|mote|cazuela|fanesca|chupe)\b/i, tags: ['soup'] },
  { match: /\b(maafe|mafe|tiguadege|domoda|palm nut soup|groundnut soup|muamba|calulu|nyembwe|egusi|okra stew|kavurma|chakhchoukha|bazeen|cuscus|rougaille|kavarma stew)\b/i, tags: ['stew'] },
  { match: /\b(tavë kosi|tave kosi|fërgesë|fergese|machanka|kletski|amiwo|ducana|fungee|pepperpot|hoppin|pepper soup)\b/i, tags: ['comforting'] },

  // Rice, noodles and grains
  { match: /\b(kolo mee|mine frit|tsuivan|kesme|lagman|laghman|beshbarmak|khinkal|halim|haleem|shorpo|osh|palov|plov|palaw|pilau|pilav|biryani|nasi|arroz|risotto|paella|jollof|congee|juk|bibimbap|donburi|onigiri|sushi|kimbap|dosa|idli|upma|poha|khichdi|thali)\b/i, tags: ['rice'] },
  { match: /\b(mohinga|khao soi|laksa|pad thai|pho|phở|bun bo|bún|mie goreng|bakmi|ramen|udon|soba|chow mein|lo mein|jjajang|naengmyeon|makaron)\b/i, tags: ['noodles'] },

  // Sweet, bread and breakfast plates
  { match: /\b(muhammar|balaleet|bamkuch|coca masegada|pastéis de milho|pasteis|kelupis|malva|melktert|koeksister|baklava|kunafa|halva|mochi|churros)\b/i, tags: ['baked'] },
  { match: /\b(balaleet|ful medames|foul medames|shakshuka|menemen|chechebsa|koko|mofo gasy|banitsa|gallo pinto|mas huni|kaya toast|congee|juk|khichdi|poha|upma|dosa|idli|arepa de huevo)\b/i, tags: [], slots: ['Breakfast'] },

  // Preparation style
  { match: /\b(mechoui|méchoui|khorovats|braai|inasal|kai yang|yakitori|barbacoa|asado|churrasco|tandoori)\b/i, tags: ['grilled'] },
  { match: /\b(pastilla|bastilla|banitsa|börek|burek|byrek|placinta|plăcintă|quiche|pastizzi|malva pudding|melktert)\b/i, tags: ['baked'] },
  { match: /\b(kelewele|shito|piri piri|peri peri|harissa|berbere|sambal|jerk|vindaloo|gochujang|kimchi|mole|birria|suya|laksa)\b/i, tags: ['spicy'] },
];

/** Tags this lexicon can add to a dish name. */
export function lexiconTags(name: string): { tags: FoodTag[]; slots: MealSlot[] } {
  const tags = new Set<FoodTag>();
  const slots = new Set<MealSlot>();
  for (const entry of DISH_LEXICON) {
    if (!entry.match.test(name)) continue;
    entry.tags.forEach((tag) => tags.add(tag));
    entry.slots?.forEach((slot) => slots.add(slot));
  }
  return { tags: [...tags], slots: [...slots] };
}
