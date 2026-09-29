# Home page photos

The photos come from the [Open Images Dataset](https://storage.googleapis.com/openimages/web/index.html) (Google).
Each photo was published on Flickr by its author under the
[Creative Commons Attribution 2.0 licence (CC BY 2.0)](https://creativecommons.org/licenses/by/2.0/).
They were cropped and resized to WebP for the website.

| Picture | File | Photographer | Original |
| --- | --- | --- | --- |
| Home banner: produce (`produce.webp`, `produce-640.webp`, `leaf.webp`) | made from 12 product photos | see below | |
| Sign-up banner: welcome | `welcome.webp` | SteFou! | [Flickr](https://www.flickr.com/photos/stephen-oung/5332718999) |
| Home banner: summer | `summer.webp` | Wicker Paradise | [Flickr](https://www.flickr.com/photos/wicker-furniture/11475851684) |
| Home banner: pickup | `pickup.webp` | Aivar Ruukel | [Flickr](https://www.flickr.com/photos/soomaa/11202779944) |
| Home banner: farmers | `farmers.webp` | U.S. Department of Agriculture | [Flickr](https://www.flickr.com/photos/usdagov/10547052435) |
| Home banner: cta-farmer | `cta-farmer.webp` | Alana King | [Flickr](https://www.flickr.com/photos/buking2010/5082580472) |
| Offers banner | `banners/deal-vegetables.webp` | Mayda Sanchez-Shingler | [Flickr](https://www.flickr.com/photos/maydaohio/8064217445) |
| Newsletter strip | `banners/fruit-basket.webp` | giorgio winklers | [Flickr](https://www.flickr.com/photos/winklers68/3056578130/) |

The produce in the home banner (`hero/produce.webp`, `hero/produce-640.webp`) and the floating leaf
(`hero/leaf.webp`) are cut-outs of the product photos of iceberg lettuce, fresh mint, broccoli, pears,
green apples, kinnow oranges, chaunsa mangoes, strawberries, kiwi, lemons, green chillies and baby spinach
(see `server/uploads/photos/CREDITS.md` for each photographer, all CC BY 2.0). The backgrounds were removed
and the pieces were arranged into one picture, so **these are changed versions of the original photos**.

The `*-1920.webp` files are 1920 px wide copies of the same photos for large screens. The originals are only
1024 px wide, so the copies were enlarged with the EDSR super-resolution model (OpenCV `dnn_superres`) and then
resized to 1920 px. They carry the same credits as the photos above. The credits are listed on the website's
**Photo credits** page (`/credits`) instead of on the photos.
