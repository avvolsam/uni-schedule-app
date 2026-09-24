// Fixtures captured verbatim (subsets, for the big one) from the real RANEPA SPb site,
// pasted by the user during development. Used to unit-test the parser without needing
// live network access to spb.ranepa.ru.

// Subset of the ЭК-3-24-03/04 semester table (id 8739): shared lectures ("...-03-04")
// plus subgroup-only practicals ("...-03" / "...-04"), spanning Sep 2-14.
export const SEMESTER_TABLE_SUBSET = `
<table id="tablepress-8739" class="tablepress tablepress-id-8739">
<thead>
<tr class="row-1 odd">
	<th class="column-1">День</th><th class="column-2">Дата</th><th class="column-3">Месяц</th><th class="column-4">Время</th><th class="column-5">Группы</th><th class="column-6">Тип</th><th class="column-7">Предмет</th><th class="column-8">Должность</th><th class="column-9">Преподаватель</th><th class="column-10">Аудитория</th>
</tr>
</thead>
<tbody class="row-hover">
<tr class="row-2 even">
	<td class="column-1">Ср.</td><td class="column-2">02</td><td class="column-3">09</td><td class="column-4">08:30-11:20</td><td class="column-5">ЭК-3-24-03-04</td><td class="column-6">Л</td><td class="column-7">Цифровое общество и управление цифровой репутацией</td><td class="column-8"><em>доц.</em></td><td class="column-9"><em>Державин С.А.</em></td><td class="column-10">304</td>
</tr>
<tr class="row-3 odd">
	<td class="column-1">Чт.</td><td class="column-2">03</td><td class="column-3">09</td><td class="column-4">08:30-11:20</td><td class="column-5">ЭК-3-24-04</td><td class="column-6">ПЗ</td><td class="column-7">Английский язык в профессиональной сфере</td><td class="column-8"><em>ст. преп.</em></td><td class="column-9"><em>Каримова К.С.</em></td><td class="column-10">312</td>
</tr>
<tr class="row-4 even">
	<td class="column-1">Чт.</td><td class="column-2">03</td><td class="column-3">09</td><td class="column-4">08:30-11:20</td><td class="column-5">ЭК-3-24-03</td><td class="column-6">ПЗ</td><td class="column-7">Английский язык в профессиональной сфере</td><td class="column-8"><em>ст. преп.</em></td><td class="column-9"><em>Щербакова В.С.</em></td><td class="column-10">216</td>
</tr>
<tr class="row-5 odd">
	<td class="column-1">Пт.</td><td class="column-2">04</td><td class="column-3">09</td><td class="column-4">15:00-17:50</td><td class="column-5">ЭК-3-24-03</td><td class="column-6">ПЗ</td><td class="column-7">Элективные курсы по физической культуре: Легкая атлетика; Фитнес; Спортивные игры</td><td class="column-8"><em>преп.</em></td><td class="column-9"><em>Кучеренко Ю.О.</em></td><td class="column-10">Стадион/спортзал</td>
</tr>
<tr class="row-6 even">
	<td class="column-1">Пт.</td><td class="column-2">04</td><td class="column-3">09</td><td class="column-4">15:00-17:50</td><td class="column-5">ЭК-3-24-04</td><td class="column-6">ПЗ</td><td class="column-7">Элективные курсы по физической культуре: Легкая атлетика; Фитнес; Спортивные игры</td><td class="column-8"><em>преп.</em></td><td class="column-9"><em>Минникаева Н.В./Хильченко А.Д. ..</em></td><td class="column-10">Стадион/спортзал</td>
</tr>
</tbody>
</table>
`;

// Full content.rendered for post id 244572 ("ЭК-6-23-01 ГИА") from
// GET /wp-json/wp/v2/raspisanie?per_page=2 — a single-group, single-row table with a
// different column order/header wording than the semester table above.
export const GIA_SINGLE_GROUP_TABLE = `
<table id="tablepress-14998" class="tablepress tablepress-id-14998">
<thead>
<tr class="row-1 odd">
	<th class="column-1">Дата</th><th class="column-2">Месяц</th><th class="column-3">День</th><th class="column-4">Время</th><th class="column-5">Группы</th><th class="column-6">ТипЗанятий</th><th class="column-7">Предмет</th><th class="column-8">Преподаватель</th><th class="column-9">Аудитория</th><th class="column-10"></th>
</tr>
</thead>
<tbody class="row-hover">
<tr class="row-2 even">
	<td class="column-1">24</td><td class="column-2">9</td><td class="column-3">Чт.</td><td class="column-4">14:00</td><td class="column-5">ЭК-6-23-01</td><td class="column-6">ИА</td><td class="column-7">Оценка диссертации на предмет её соответствия критериям (ФЗ от 23.08.1996 г. № 127-ФЗ «О науке и государственной научно-технической политике»)</td><td class="column-8">Комиссия ..</td><td class="column-9">309</td><td class="column-10"></td>
</tr>
</tbody>
</table>
`;

// Full content.rendered for post id 244538 ("ЭК-6-24-03 сессия") — two rows, single
// group, standard header order, no "Должность" column (position embedded via <em> only
// on the teacher cell in one row).
export const SESSION_SINGLE_GROUP_TABLE = `
<table id="tablepress-14997" class="tablepress tablepress-id-14997">
<thead>
<tr class="row-1 odd">
	<th class="column-1">День</th><th class="column-2">Дата</th><th class="column-3">Месяц</th><th class="column-4">Время</th><th class="column-5">Группы</th><th class="column-6">Тип</th><th class="column-7">Предмет</th><th class="column-8">Должность</th><th class="column-9">Преподаватель</th><th class="column-10">Аудитория</th>
</tr>
</thead>
<tbody class="row-hover">
<tr class="row-2 even">
	<td class="column-1">Пн.</td><td class="column-2">21</td><td class="column-3">09</td><td class="column-4">18:00-20:50</td><td class="column-5">ЭК-6-24-03</td><td class="column-6">К</td><td class="column-7">КОНСУЛЬТАЦИЯ: Кандидатский экзамен по специальной дисциплине в соответствии с темой диссертации на соискание учёной степени кандидата наук</td><td class="column-8"><em>проф.</em></td><td class="column-9"><em>Липатова Л.Н.</em></td><td class="column-10">СДО РАНХиГС</td>
</tr>
<tr class="row-3 odd">
	<td class="column-1">Чт.</td><td class="column-2">24</td><td class="column-3">09</td><td class="column-4">13:00</td><td class="column-5">ЭК-6-24-03</td><td class="column-6">Э</td><td class="column-7">ЭКЗАМЕН: Кандидатский экзамен по специальной дисциплине в соответствии с темой диссертации на соискание учёной степени кандидата наук</td><td class="column-8"></td><td class="column-9"><em>Комиссия ..</em></td><td class="column-10">309</td>
</tr>
</tbody>
</table>
`;
