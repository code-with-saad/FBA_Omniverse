import env from '../config/env.js';

/**
 * "Write with AI" for product descriptions.
 *
 * With ANTHROPIC_API_KEY in server/.env the text is written by Claude. Without a key (or when the
 * API cannot be reached) a built-in writer creates it from a small produce knowledge base, the
 * category and the farmer's practices, so the button always works, even offline.
 */

// Keyword -> what the product is like, how people use it and how to keep it
const KNOWLEDGE = [
  { k: /mango|aam/, taste: 'sweet, fragrant and juicy, with smooth fibre-free flesh', use: 'eating fresh, milkshakes, lassi or a summer fruit chaat', keep: 'Leave at room temperature until they give slightly when pressed, then chill.', useUr: 'تازہ کھانے، ملک شیک، لسی یا گرمیوں کی فروٹ چاٹ کے لیے', keepUr: 'کمرے کے درجۂ حرارت پر رکھیں، دبانے پر ہلکے نرم ہو جائیں تو فریج میں رکھ دیں۔' },
  { k: /tomato/, taste: 'deep red and full of flavour, picked ripe from the vine', use: 'salads, salan, chutney and home-made ketchup', keep: 'Keep out of the fridge so they stay fragrant.', useUr: 'سلاد، سالن، چٹنی اور گھر کے بنے کیچپ کے لیے', keepUr: 'فریج سے باہر رکھیں تاکہ ان کی خوشبو برقرار رہے۔' },
  { k: /potato|aloo/, taste: 'firm and creamy, freshly dug with the skin on', use: 'aloo bhujia, fries, curries and parathas', keep: 'Store in a cool, dark place away from onions.', useUr: 'آلو بھجیا، فرائز، سالن اور پراٹھوں کے لیے', keepUr: 'ٹھنڈی اور اندھیری جگہ پر، پیاز سے دور رکھیں۔' },
  { k: /onion|pyaz/, taste: 'crisp with a clean, sharp bite', use: 'tarka, salads and every everyday curry', keep: 'Keep dry and airy; they last for weeks.', useUr: 'تڑکے، سلاد اور روزمرہ کے ہر سالن کے لیے', keepUr: 'خشک اور ہوادار جگہ پر رکھیں؛ یہ کئی ہفتے چلتے ہیں۔' },
  { k: /garlic|lehsan/, taste: 'plump, aromatic cloves with a strong, sweet heat', use: 'tarka, marinades and chutneys', keep: 'Store whole bulbs in a dry, airy basket.', useUr: 'تڑکے، مسالے دار میرینیڈ اور چٹنیوں کے لیے', keepUr: 'پوری گٹھیاں خشک اور ہوادار ٹوکری میں رکھیں۔' },
  { k: /ginger|adrak/, taste: 'fresh, fibrous and pleasantly fiery', use: 'chai, ginger-garlic paste and stir-fries', keep: 'Wrap and keep in the fridge for up to three weeks.', useUr: 'چائے، ادرک لہسن کے پیسٹ اور فرائی کے لیے', keepUr: 'لپیٹ کر فریج میں رکھیں، تین ہفتے تک چلتی ہے۔' },
  { k: /spinach|palak/, taste: 'tender, dark-green leaves harvested young', use: 'palak paneer, saag, soups and smoothies', keep: 'Wrap loosely in a damp cloth and refrigerate; best within three days.', useUr: 'پالک پنیر، ساگ، سوپ اور اسموتھی کے لیے', keepUr: 'گیلے کپڑے میں ہلکا سا لپیٹ کر فریج میں رکھیں؛ تین دن کے اندر استعمال بہتر ہے۔' },
  { k: /carrot|gajar/, taste: 'crunchy and naturally sweet', use: 'gajar ka halwa, salads, juices and pickles', keep: 'Remove the tops and keep in the fridge crisper.', useUr: 'گاجر کے حلوے، سلاد، جوس اور اچار کے لیے', keepUr: 'اوپر کے پتے ہٹا کر فریج کے سبزی والے خانے میں رکھیں۔' },
  { k: /cucumber|kheera/, taste: 'cool, crisp and refreshing with thin skin', use: 'raita, salads and summer drinks', keep: 'Refrigerate and use within a week.', useUr: 'رائتے، سلاد اور گرمیوں کے مشروبات کے لیے', keepUr: 'فریج میں رکھیں اور ایک ہفتے کے اندر استعمال کریں۔' },
  { k: /capsicum|pepper|shimla/, taste: 'glossy, crunchy and mildly sweet', use: 'stir-fries, pizza, salads and stuffed shimla mirch', keep: 'Keep dry in the fridge.', useUr: 'فرائی، پیزا، سلاد اور بھری ہوئی شملہ مرچ کے لیے', keepUr: 'فریج میں خشک رکھیں۔' },
  { k: /okra|bhindi/, taste: 'tender, young pods that stay crisp when cooked', use: 'bhindi masala and crispy fried bhindi', keep: 'Keep dry and cook within two to three days.', useUr: 'بھنڈی مسالا اور کرکری تلی ہوئی بھنڈی کے لیے', keepUr: 'خشک رکھیں اور دو تین دن کے اندر پکا لیں۔' },
  { k: /brinjal|eggplant|aubergine|baingan/, taste: 'glossy, firm and freshly picked', use: 'baingan bharta, salan and crispy pakoras', keep: 'Keep in a cool place and cook within a few days.', useUr: 'بینگن کے بھرتے، سالن اور کرکرے پکوڑوں کے لیے', keepUr: 'ٹھنڈی جگہ پر رکھیں اور چند دن میں پکا لیں۔' },
  { k: /chilli|chili|mirch/, taste: 'crisp, bright green and pleasantly hot', use: 'salan, chutneys, raita and pickles', keep: 'Keep dry in the fridge; removing the stems helps them last longer.', useUr: 'سالن، چٹنی، رائتے اور اچار کے لیے', keepUr: 'فریج میں خشک رکھیں؛ ڈنٹھل ہٹانے سے دیر تک چلتی ہیں۔' },
  { k: /broccoli/, taste: 'tight, dark-green florets with tender stems', use: 'stir-fries, soups and quick steamed sides', keep: 'Keep chilled and use within four days.', useUr: 'فرائی، سوپ اور جلدی تیار ہونے والی بھاپ کی ڈش کے لیے', keepUr: 'ٹھنڈا رکھیں اور چار دن کے اندر استعمال کریں۔' },
  { k: /mushroom/, taste: 'firm, white and pleasantly earthy', use: 'stir-fries, soups, pasta and omelettes', keep: 'Keep in a paper bag in the fridge.', useUr: 'فرائی، سوپ، پاستا اور آملیٹ کے لیے', keepUr: 'کاغذ کے لفافے میں ڈال کر فریج میں رکھیں۔' },
  { k: /coconut|nariyal/, taste: 'young green coconuts full of sweet, cool coconut water', use: 'a refreshing drink and the soft malai inside', keep: 'Keep in a cool place and open within a few days.', useUr: 'تازگی بخش مشروب اور اندر کی نرم ملائی کے لیے', keepUr: 'ٹھنڈی جگہ پر رکھیں اور چند دن میں کھول لیں۔' },
  { k: /cauliflower|gobi/, taste: 'tight, creamy-white florets', use: 'aloo gobi, pakoras and roasted gobi', keep: 'Refrigerate with the leaves on.', useUr: 'آلو گوبھی، پکوڑوں اور بھنی ہوئی گوبھی کے لیے', keepUr: 'پتوں سمیت فریج میں رکھیں۔' },
  { k: /cabbage|band gobi/, taste: 'crisp, tightly packed leaves', use: 'coleslaw, stir-fries and cabbage sabzi', keep: 'Keeps well in the fridge for a week or more.', useUr: 'کول سلا، فرائی اور بند گوبھی کی سبزی کے لیے', keepUr: 'فریج میں ایک ہفتے یا اس سے زیادہ ٹھیک رہتی ہے۔' },
  { k: /peas|matar/, taste: 'sweet, bright-green peas', use: 'matar pulao, aloo matar and keema', keep: 'Keep chilled and shell just before cooking.', useUr: 'مٹر پلاؤ، آلو مٹر اور قیمے کے لیے', keepUr: 'ٹھنڈا رکھیں اور پکانے سے ذرا پہلے چھیلیں۔' },
  { k: /corn|makai/, taste: 'sweet, milky kernels', use: 'roasting on coals, corn chaat and soups', keep: 'Cook soon after pickup for the sweetest taste.', useUr: 'کوئلوں پر بھوننے، کارن چاٹ اور سوپ کے لیے', keepUr: 'سب سے میٹھے ذائقے کے لیے وصولی کے فوراً بعد پکائیں۔' },
  { k: /lemon|lime|nimbu/, taste: 'thin-skinned and bursting with juice', use: 'nimbu pani, salads, marinades and pickles', keep: 'Store at room temperature or chill for longer life.', useUr: 'لیموں پانی، سلاد، میرینیڈ اور اچار کے لیے', keepUr: 'کمرے کے درجۂ حرارت پر رکھیں، زیادہ دیر کے لیے فریج میں۔' },
  { k: /orange|kinnow|malta/, taste: 'juicy and sweet-tart, easy to peel', use: 'fresh juice, snacks and desserts', keep: 'Keep in a cool place or the fridge.', useUr: 'تازہ جوس، ہلکے ناشتے اور میٹھے کے لیے', keepUr: 'ٹھنڈی جگہ یا فریج میں رکھیں۔' },
  { k: /apple|saib/, taste: 'crisp, juicy and naturally sweet', use: 'snacking, lunch boxes and baking', keep: 'Refrigerate to keep them crunchy.', useUr: 'ویسے کھانے، بچوں کے لنچ باکس اور بیکنگ کے لیے', keepUr: 'کرکرا رکھنے کے لیے فریج میں رکھیں۔' },
  { k: /banana|kela/, taste: 'creamy and naturally sweet', use: 'breakfast, milkshakes and banana bread', keep: 'Keep at room temperature, away from other fruit.', useUr: 'ناشتے، ملک شیک اور بنانا بریڈ کے لیے', keepUr: 'کمرے کے درجۂ حرارت پر، دوسرے پھلوں سے الگ رکھیں۔' },
  { k: /grape|angoor/, taste: 'sweet, juicy and crisp', use: 'snacking and fruit salads', keep: 'Refrigerate unwashed and rinse just before eating.', useUr: 'ویسے کھانے اور فروٹ سلاد کے لیے', keepUr: 'بغیر دھوئے فریج میں رکھیں اور کھانے سے ذرا پہلے دھوئیں۔' },
  { k: /guava|amrood/, taste: 'fragrant with sweet, pink or white flesh', use: 'eating with chaat masala, juices and jam', keep: 'Ripen at room temperature, then refrigerate.', useUr: 'چاٹ مسالے کے ساتھ کھانے، جوس اور جام کے لیے', keepUr: 'کمرے کے درجۂ حرارت پر پکنے دیں، پھر فریج میں رکھیں۔' },
  { k: /strawberr/, taste: 'bright red, sweet and aromatic', use: 'desserts, milkshakes and breakfast bowls', keep: 'Keep chilled and eat within two days.', useUr: 'میٹھے، ملک شیک اور ناشتے کے لیے', keepUr: 'ٹھنڈا رکھیں اور دو دن کے اندر کھا لیں۔' },
  { k: /cherr/, taste: 'dark, glossy and sweet', use: 'snacking, desserts and baking', keep: 'Keep chilled and unwashed until eating.', useUr: 'ویسے کھانے، میٹھے اور بیکنگ کے لیے', keepUr: 'کھانے تک بغیر دھوئے ٹھنڈا رکھیں۔' },
  { k: /peach|aaru/, taste: 'soft, fragrant and dripping with juice', use: 'eating fresh, desserts and jams', keep: 'Ripen at room temperature, then chill.', useUr: 'تازہ کھانے، میٹھے اور جام کے لیے', keepUr: 'کمرے کے درجۂ حرارت پر پکنے دیں، پھر ٹھنڈا کریں۔' },
  { k: /pear|nashpati/, taste: 'juicy with a delicate sweetness', use: 'snacking, salads and poaching', keep: 'Ripen on the counter, then refrigerate.', useUr: 'ویسے کھانے، سلاد اور ہلکا پکانے کے لیے', keepUr: 'باہر رکھ کر پکنے دیں، پھر فریج میں رکھیں۔' },
  { k: /kiwi/, taste: 'tangy-sweet with bright green flesh', use: 'breakfast, smoothies and fruit salads', keep: 'Ripen at room temperature; chill once soft.', useUr: 'ناشتے، اسموتھی اور فروٹ سلاد کے لیے', keepUr: 'کمرے کے درجۂ حرارت پر پکنے دیں؛ نرم ہو جائے تو ٹھنڈا کریں۔' },
  { k: /pomegranate|anar/, taste: 'ruby-red, sweet-tart seeds', use: 'fresh juice, raita, salads and chaat', keep: 'Keeps for weeks in a cool place.', useUr: 'تازہ جوس، رائتے، سلاد اور چاٹ کے لیے', keepUr: 'ٹھنڈی جگہ پر کئی ہفتے ٹھیک رہتا ہے۔' },
  { k: /melon|watermelon|tarbooz|kharbooza/, taste: 'sweet, cool and very juicy', use: 'summer snacks and fresh juice', keep: 'Keep whole at room temperature; chill once cut.', useUr: 'گرمیوں کے ہلکے ناشتے اور تازہ جوس کے لیے', keepUr: 'پورا کمرے کے درجۂ حرارت پر رکھیں؛ کاٹنے کے بعد ٹھنڈا کریں۔' },
  { k: /date|khajoor/, taste: 'soft, rich and caramel-sweet', use: 'iftar, snacks and desserts', keep: 'Store in an airtight jar.', useUr: 'افطار، ہلکے ناشتے اور میٹھے کے لیے', keepUr: 'ہوا بند برتن میں رکھیں۔' },
  { k: /honey|shehad/, taste: 'raw, unfiltered and full of floral flavour', use: 'breakfast, tea, baking and a spoonful on its own', keep: 'Store at room temperature; it may crystallise naturally.', useUr: 'ناشتے، چائے، بیکنگ اور ویسے ایک چمچ کھانے کے لیے', keepUr: 'کمرے کے درجۂ حرارت پر رکھیں؛ قدرتی طور پر جم بھی سکتا ہے۔' },
  { k: /jam|marmalade|preserve/, taste: 'made in small batches with plenty of fruit', use: 'toast, parathas and baking', keep: 'Refrigerate after opening.', useUr: 'ٹوسٹ، پراٹھوں اور بیکنگ کے لیے', keepUr: 'کھولنے کے بعد فریج میں رکھیں۔' },
  { k: /chutney|pickle|achar/, taste: 'tangy, spiced and made the traditional way', use: 'daal chawal, parathas and sandwiches', keep: 'Use a dry spoon and keep the lid closed.', useUr: 'دال چاول، پراٹھوں اور سینڈوچ کے لیے', keepUr: 'خشک چمچ استعمال کریں اور ڈھکن بند رکھیں۔' },
  { k: /olive/, taste: 'firm and savoury, cured in brine', use: 'salads, pizza and snack platters', keep: 'Keep covered in brine and refrigerate after opening.', useUr: 'سلاد، پیزا اور ہلکے ناشتے کے لیے', keepUr: 'نمکین پانی میں ڈوبے رکھیں اور کھولنے کے بعد فریج میں رکھیں۔' },
  { k: /milk|doodh/, taste: 'fresh, creamy and collected the same morning', use: 'chai, kheer and breakfast', keep: 'Boil and refrigerate; use within two days.', useUr: 'چائے، کھیر اور ناشتے کے لیے', keepUr: 'ابال کر فریج میں رکھیں؛ دو دن کے اندر استعمال کریں۔' },
  { k: /yogurt|yoghurt|dahi/, taste: 'thick, set naturally and mildly tangy', use: 'raita, lassi and marinades', keep: 'Keep chilled.', useUr: 'رائتے، لسی اور میرینیڈ کے لیے', keepUr: 'ٹھنڈا رکھیں۔' },
  { k: /paneer|cottage/, taste: 'soft, fresh and milky', use: 'palak paneer, tikka and bhurji', keep: 'Keep in water in the fridge and use within three days.', useUr: 'پالک پنیر، تکے اور بھرجی کے لیے', keepUr: 'فریج میں پانی میں ڈبو کر رکھیں اور تین دن میں استعمال کریں۔' },
  { k: /cheese/, taste: 'rich and full of flavour', use: 'sandwiches, pasta and cheese boards', keep: 'Wrap well and refrigerate.', useUr: 'سینڈوچ، پاستا اور چیز بورڈ کے لیے', keepUr: 'اچھی طرح لپیٹ کر فریج میں رکھیں۔' },
  { k: /butter|makhan|ghee/, taste: 'rich and golden, churned in small batches', use: 'parathas, daal tarka and baking', keep: 'Keep in a cool place or the fridge.', useUr: 'پراٹھوں، دال کے تڑکے اور بیکنگ کے لیے', keepUr: 'ٹھنڈی جگہ یا فریج میں رکھیں۔' },
  { k: /egg|anday/, taste: 'fresh eggs with deep orange yolks', use: 'breakfast, halwa and baking', keep: 'Refrigerate, pointed end down.', useUr: 'ناشتے، حلوے اور بیکنگ کے لیے', keepUr: 'نوکیلا سرا نیچے کر کے فریج میں رکھیں۔' },
  { k: /bread|loaf|naan|baguette|sourdough|\bbuns?\b|bagel/, taste: 'baked the morning of the market with a golden crust', use: 'breakfast, sandwiches and with soups', keep: 'Keep in a paper bag; toast on day two.', useUr: 'ناشتے، سینڈوچ اور سوپ کے ساتھ', keepUr: 'کاغذ کے لفافے میں رکھیں؛ دوسرے دن ٹوسٹ کر لیں۔' },
  { k: /croissant|pastry|cookie|biscuit|pie|cake|rusk/, taste: 'freshly baked, buttery and golden', use: 'tea time, breakfast and gifting', keep: 'Best on the day; keep in an airtight box.', useUr: 'چائے کے وقت، ناشتے اور تحفے کے لیے', keepUr: 'اسی دن سب سے اچھا؛ ہوا بند ڈبے میں رکھیں۔' },
  { k: /rice|chawal|basmati/, taste: 'long, fragrant grains that cook up fluffy', use: 'biryani, pulao and plain chawal', keep: 'Store dry in an airtight container.', useUr: 'بریانی، پلاؤ اور سادہ چاول کے لیے', keepUr: 'ہوا بند برتن میں خشک رکھیں۔' },
  { k: /atta|flour/, taste: 'stone-ground and wholesome', use: 'soft rotis, parathas and baking', keep: 'Store airtight in a cool, dry place.', useUr: 'نرم روٹیوں، پراٹھوں اور بیکنگ کے لیے', keepUr: 'ٹھنڈی اور خشک جگہ پر ہوا بند رکھیں۔' },
  { k: /lentil|daal|dal|bean|chickpea|chana|masoor|moong|rajma/, taste: 'clean, even grains that cook evenly', use: 'daal, salan and salads', keep: 'Store airtight in a cool, dry place.', useUr: 'دال، سالن اور سلاد کے لیے', keepUr: 'ٹھنڈی اور خشک جگہ پر ہوا بند رکھیں۔' },
  { k: /peanut|almond|walnut|nut|badam|akhrot/, taste: 'crunchy and freshly roasted', use: 'snacking, desserts and garnishing', keep: 'Keep airtight to stay crunchy.', useUr: 'ویسے کھانے، میٹھے اور سجاوٹ کے لیے', keepUr: 'کرکرا رکھنے کے لیے ہوا بند رکھیں۔' },
  { k: /mint|podina|coriander|dhania|basil|herb|parsley|methi|fenugreek/, taste: 'fragrant and freshly cut', use: 'chutneys, garnishing, raita and teas', keep: 'Stand the stems in water or wrap in a damp cloth in the fridge.', useUr: 'چٹنی، سجاوٹ، رائتے اور قہوے کے لیے', keepUr: 'ڈنٹھل پانی میں رکھیں یا گیلے کپڑے میں لپیٹ کر فریج میں رکھیں۔' },
  { k: /lettuce|salad|greens|rocket|kale/, taste: 'crisp, tender leaves', use: 'salads, wraps and burgers', keep: 'Keep chilled in a bag with a paper towel.', useUr: 'سلاد، رول اور برگر کے لیے', keepUr: 'کاغذی تولیے کے ساتھ تھیلی میں ڈال کر ٹھنڈا رکھیں۔' },
  { k: /rose|tulip|sunflower|flower|bouquet|bunch|lily|orchid/, taste: 'cut fresh on market morning with long, strong stems', use: 'brightening your home or as a gift', keep: 'Trim the stems and change the water every two days.', useUr: 'گھر سجانے یا تحفے کے لیے', keepUr: 'ڈنٹھل تھوڑے کاٹ دیں اور ہر دو دن بعد پانی بدلیں۔' },
  { k: /plant|money plant|cactus|succulent|hibiscus|\bpot(ted)?\b/, taste: 'healthy, well-rooted and ready for a new home', use: 'balconies, windowsills and gifting', keep: 'Water when the top of the soil feels dry and keep in bright, indirect light.', useUr: 'بالکونی، کھڑکی اور تحفے کے لیے', keepUr: 'مٹی کی اوپری تہہ خشک لگے تو پانی دیں، اور تیز مگر بالواسطہ روشنی میں رکھیں۔' },
];

const CATEGORY_FALLBACK = [
  { k: /fruit/, taste: 'picked ripe for the best flavour', use: 'snacking, desserts and fresh juice', keep: 'Keep cool and enjoy within a few days.', useUr: 'ویسے کھانے، میٹھے اور تازہ جوس کے لیے', keepUr: 'ٹھنڈا رکھیں اور چند دن میں کھا لیں۔' },
  { k: /veg/, taste: 'harvested for market day and full of flavour', use: 'everyday home cooking', keep: 'Keep cool and use within a few days.', useUr: 'روزمرہ کے گھریلو کھانوں کے لیے', keepUr: 'ٹھنڈا رکھیں اور چند دن میں استعمال کریں۔' },
  { k: /dairy|egg/, taste: 'fresh from the farm', use: 'breakfast and home cooking', keep: 'Keep refrigerated.', useUr: 'ناشتے اور گھریلو کھانوں کے لیے', keepUr: 'فریج میں رکھیں۔' },
  { k: /bak/, taste: 'baked fresh the morning of the market', use: 'breakfast and tea time', keep: 'Best on the day it is bought.', useUr: 'ناشتے اور چائے کے وقت کے لیے', keepUr: 'خریدنے کے دن ہی سب سے اچھا۔' },
  { k: /herb|green/, taste: 'fragrant and freshly cut', use: 'cooking, chutneys and garnishing', keep: 'Keep in the fridge wrapped in a damp cloth.', useUr: 'کھانوں، چٹنی اور سجاوٹ کے لیے', keepUr: 'گیلے کپڑے میں لپیٹ کر فریج میں رکھیں۔' },
  { k: /honey|preserve/, taste: 'made in small batches', use: 'breakfast and cooking', keep: 'Store in a cool place.', useUr: 'ناشتے اور کھانوں کے لیے', keepUr: 'ٹھنڈی جگہ پر رکھیں۔' },
  { k: /grain|pulse/, taste: 'clean and carefully sorted', use: 'everyday cooking', keep: 'Store airtight in a cool, dry place.', useUr: 'روزمرہ کے کھانوں کے لیے', keepUr: 'ٹھنڈی اور خشک جگہ پر ہوا بند رکھیں۔' },
  { k: /flower|plant/, taste: 'fresh and healthy', use: 'brightening your home or as a gift', keep: 'Keep out of harsh sun.', useUr: 'گھر سجانے یا تحفے کے لیے', keepUr: 'تیز دھوپ سے بچا کر رکھیں۔' },
];

const OPENERS = [
  (n, f) => `${n} from ${f}`,
  (n, f) => `Fresh ${n.toLowerCase()} grown and brought to market by ${f}`,
  (n, f) => `Our ${n.toLowerCase()} at ${f}`,
];

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** The main word of a product name is usually the last one ("Mango Chutney" is a chutney). */
function findKnowledge(name) {
  const text = name.toLowerCase();
  let best = null;
  for (const entry of KNOWLEDGE) {
    const m = entry.k.exec(text);
    if (!m) continue;
    // the match that ends last wins; when two end together, the longer one ("sweet potato" over "potato")
    const end = m.index + m[0].length;
    if (!best || end > best.end || (end === best.end && m[0].length > best.len)) best = { entry, end, len: m[0].length };
  }
  return best?.entry || null;
}

/** What a product is like, how it is used and how to keep it (knowledge base, then the category). */
export function produceInfo(name, category = '') {
  return findKnowledge(name) || CATEGORY_FALLBACK.find((x) => x.k.test(String(category).toLowerCase())) || { taste: 'fresh and full of flavour', use: 'everyday cooking', keep: 'Keep cool and enjoy it fresh.' };
}

/** Built-in writer: 3 sentences from the knowledge base; `variant` changes the wording. */
export function localDescription({ name, category = '', unit = '', stallName = 'our farm', practices = [], variant = 0 }) {
  const info = produceInfo(name, category);
  const v = Math.abs(Number(variant) || 0);
  const opener = OPENERS[v % OPENERS.length](name.trim(), stallName);
  const practice = practices.length ? ` (${practices.slice(0, 2).map(lowerFirst).join(', ')})` : '';
  const sentences = [
    `${opener}${practice}: ${info.taste}.`,
    v % 2 === 0 ? `Perfect for ${info.use}.` : `Great for ${info.use}.`,
    unit ? `Sold per ${unit} and reserved for you until pickup. ${info.keep}` : info.keep,
  ];
  return sentences.join(' ');
}

/** Asks Claude for a description (only when ANTHROPIC_API_KEY is set). */
async function claudeDescription(details) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers: { 'content-type': 'application/json', 'x-api-key': env.anthropic.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env.anthropic.model,
      max_tokens: 300,
      system:
        'You write product descriptions for MarketLink, a farmers market pre-order website in Pakistan. Write 2 or 3 short sentences (at most 60 words) in plain, friendly English: what the product is like, what it is good for and one storage tip. No emoji, no prices, no health claims, no quotation marks.',
      messages: [
        {
          role: 'user',
          content: `Product: ${details.name}\nCategory: ${details.category || 'unknown'}\nSold per: ${details.unit || 'unit'}\nFarm / stall: ${details.stallName}${details.practices.length ? `\nFarming practices: ${details.practices.join(', ')}` : ''}${details.variant ? '\nWrite a different version from before.' : ''}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const data = await res.json();
  const text = data.content?.find((c) => c.type === 'text')?.text?.trim();
  if (!text) throw new Error('Empty answer');
  return text.replace(/^["']|["']$/g, '').slice(0, 1500);
}

export async function describeProduct(details) {
  if (env.anthropic.apiKey) {
    try {
      return { description: await claudeDescription(details), source: 'claude' };
    } catch (err) {
      console.warn('[ai] Claude description failed, using the built-in writer:', err.message);
    }
  }
  return { description: localDescription(details), source: 'local' };
}

// ---------------------------------------------------------------- farm / stall descriptions ("About the farm")

const FARM_OPENERS = [
  (d) => `${d.stallName} is a local farm${d.city ? ` from ${d.city}` : ''}`,
  (d) => `At ${d.stallName}${d.city ? ` near ${d.city}` : ''}, we grow food the way our families always have`,
  (d) => `${d.stallName} brings fresh, seasonal produce${d.city ? ` from the fields around ${d.city}` : ''} straight to your market`,
];

const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/** Built-in writer for the farm bio shown on the public stall page. */
export function localFarmBio(d) {
  const v = Math.abs(Number(d.variant) || 0);
  const grows = d.categories.length ? list(d.categories.map((c) => c.toLowerCase())) : 'seasonal produce';
  const parts = [`${FARM_OPENERS[v % FARM_OPENERS.length](d)}.`];
  parts.push(
    [`We bring ${grows}, picked and packed for every market day.`, `Our stall offers ${grows}, harvested close to market day so it reaches you fresh.`, `Look out for our ${grows} on every market day.`][v % 3]
  );
  const extra = d.practices.slice(0, 4);
  if (extra.length) parts.push(`What makes us different: ${list(extra.map(lowerFirst))}.`);
  if (d.markets.length) parts.push(`Find us at ${list(d.markets.slice(0, 3))}${d.markets.length > 3 ? ' and more' : ''}.`);
  parts.push(v % 3 === 2 ? 'Pre-order on MarketLink and we will have your basket ready for pickup.' : 'Pre-order online, pick up at the stall and pay in person.');
  return parts.join(' ');
}

async function claudeFarmBio(d) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers: { 'content-type': 'application/json', 'x-api-key': env.anthropic.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env.anthropic.model,
      max_tokens: 350,
      system:
        'You write the "About the farm" text for stalls on MarketLink, a farmers market pre-order website in Pakistan. Write 3 or 4 short, warm sentences (at most 80 words) in plain English, in the first person plural (we). No emoji, no prices, no invented awards or certifications, no quotation marks.',
      messages: [
        {
          role: 'user',
          content: `Stall: ${d.stallName}\nCity: ${d.city || 'unknown'}\nGrows / sells: ${d.categories.join(', ') || 'seasonal produce'}\nFarming practices: ${d.practices.join(', ') || 'none given'}\nMarkets: ${d.markets.join(', ') || 'none yet'}${d.variant ? '\nWrite a different version from before.' : ''}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const data = await res.json();
  const text = data.content?.find((c) => c.type === 'text')?.text?.trim();
  if (!text) throw new Error('Empty answer');
  return text.replace(/^["']|["']$/g, '').slice(0, 1200);
}

export async function describeFarm(details) {
  if (env.anthropic.apiKey) {
    try {
      return { description: await claudeFarmBio(details), source: 'claude' };
    } catch (err) {
      console.warn('[ai] Claude farm description failed, using the built-in writer:', err.message);
    }
  }
  return { description: localFarmBio(details), source: 'local' };
}
