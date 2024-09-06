const ROOT_URL = 'https://enotes.pointschool.ru' as const;
const URLs = {
  root: ROOT_URL,
  basket: `${ROOT_URL}/basket`,
  basketClear: `${ROOT_URL}/basket/clear`,
} as const;

type URLs = typeof URLs;

export { URLs };