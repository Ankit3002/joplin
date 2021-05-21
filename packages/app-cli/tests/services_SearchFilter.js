/* eslint-disable no-unused-vars */
/* eslint prefer-const: 0*/


const time = require('@joplin/lib/time').default;
const { fileContentEqual, setupDatabase, setupDatabaseAndSynchronizer, db, synchronizer, fileApi, sleep, createNTestNotes, switchClient, createNTestFolders } = require('@joplin/lib/testing/test-utils.js');
const SearchEngine = require('@joplin/lib/services/searchengine/SearchEngine').default;
const Note = require('@joplin/lib/models/Note').default;
const Folder = require('@joplin/lib/models/Folder').default;
const Tag = require('@joplin/lib/models/Tag').default;
const ItemChange = require('@joplin/lib/models/ItemChange').default;
const Setting = require('@joplin/lib/models/Setting').default;
const Resource = require('@joplin/lib/models/Resource').default;
const shim = require('@joplin/lib/shim').default;
const ResourceService = require('@joplin/lib/services/ResourceService').default;


let engine = null;

const ids = (array) => array.map(a => a.id);

describe('services_SearchFilter', function() {
	beforeEach(async (done) => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);

		engine = new SearchEngine();
		engine.setDb(db());

		done();
	});


	it('should return note matching title', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'abcd', body: 'body 1' });
		const n2 = await Note.save({ title: 'efgh', body: 'body 2' });

		await engine.syncTables();
		rows = await engine.search('title: abcd');

		expect(rows.length).toBe(1);
		expect(rows[0].id).toBe(n1.id);
	}));

	it('should return note matching negated title', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'abcd', body: 'body 1' });
		const n2 = await Note.save({ title: 'efgh', body: 'body 2' });

		await engine.syncTables();
		rows = await engine.search('-title: abcd');

		expect(rows.length).toBe(1);
		expect(rows[0].id).toBe(n2.id);
	}));

	it('should return note matching body', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'abcd', body: 'body1' });
		const n2 = await Note.save({ title: 'efgh', body: 'body2' });

		await engine.syncTables();
		rows = await engine.search('body: body1');

		expect(rows.length).toBe(1);
		expect(rows[0].id).toBe(n1.id);
	}));

	it('should return note matching negated body', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'abcd', body: 'body1' });
		const n2 = await Note.save({ title: 'efgh', body: 'body2' });

		await engine.syncTables();
		rows = await engine.search('-body: body1');

		expect(rows.length).toBe(1);
		expect(rows[0].id).toBe(n2.id);
	}));

	it('should return note matching title containing multiple words', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'abcd xyz', body: 'body1' });
		const n2 = await Note.save({ title: 'efgh ijk', body: 'body2' });

		await engine.syncTables();
		rows = await engine.search('title: "abcd xyz"');

		expect(rows.length).toBe(1);
		expect(rows[0].id).toBe(n1.id);
	}));

	it('should return note matching body containing multiple words', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'abcd', body: 'ho ho ho' });
		const n2 = await Note.save({ title: 'efgh', body: 'foo bar' });

		await engine.syncTables();
		rows = await engine.search('body: "foo bar"');

		expect(rows.length).toBe(1);
		expect(rows[0].id).toBe(n2.id);
	}));

	it('should return note matching title AND body', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'abcd', body: 'ho ho ho' });
		const n2 = await Note.save({ title: 'efgh', body: 'foo bar' });

		await engine.syncTables();
		rows = await engine.search('title: efgh body: "foo bar"');
		expect(rows.length).toBe(1);
		expect(rows[0].id).toBe(n2.id);

		rows = await engine.search('title: abcd body: "foo bar"');
		expect(rows.length).toBe(0);
	}));

	it('should return note matching title OR body', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'abcd', body: 'ho ho ho' });
		const n2 = await Note.save({ title: 'efgh', body: 'foo bar' });

		await engine.syncTables();
		rows = await engine.search('any:1 title: abcd body: "foo bar"');
		expect(rows.length).toBe(2);
		expect(rows.map(r=>r.id)).toContain(n1.id);
		expect(rows.map(r=>r.id)).toContain(n2.id);

		rows = await engine.search('any:1 title: wxyz body: "blah blah"');
		expect(rows.length).toBe(0);
	}));

	it('should return notes matching text', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'foo beef', body: 'dead bar' });
		const n2 = await Note.save({ title: 'bar efgh', body: 'foo dog' });
		const n3 = await Note.save({ title: 'foo ho', body: 'ho ho ho' });
		await engine.syncTables();

		// Interpretation: Match with notes containing foo in title/body and bar in title/body
		// Note: This is NOT saying to match notes containing foo bar in title/body
		rows = await engine.search('foo bar');
		expect(rows.length).toBe(2);
		expect(rows.map(r=>r.id)).toContain(n1.id);
		expect(rows.map(r=>r.id)).toContain(n2.id);

		rows = await engine.search('foo -bar');
		expect(rows.length).toBe(1);
		expect(rows.map(r=>r.id)).toContain(n3.id);

		rows = await engine.search('foo efgh');
		expect(rows.length).toBe(1);
		expect(rows[0].id).toBe(n2.id);

		rows = await engine.search('zebra');
		expect(rows.length).toBe(0);
	}));

	it('should return notes matching any negated text', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'abc', body: 'def' });
		const n2 = await Note.save({ title: 'def', body: 'ghi' });
		const n3 = await Note.save({ title: 'ghi', body: 'jkl' });
		await engine.syncTables();

		rows = await engine.search('any:1 -abc -ghi');
		expect(rows.length).toBe(3);
		expect(rows.map(r=>r.id)).toContain(n1.id);
		expect(rows.map(r=>r.id)).toContain(n2.id);
		expect(rows.map(r=>r.id)).toContain(n3.id);
	}));

	it('should return notes matching any negated title', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'abc', body: 'def' });
		const n2 = await Note.save({ title: 'def', body: 'ghi' });
		const n3 = await Note.save({ title: 'ghi', body: 'jkl' });
		await engine.syncTables();

		rows = await engine.search('any:1 -title:abc -title:ghi');
		expect(rows.length).toBe(3);
		expect(rows.map(r=>r.id)).toContain(n1.id);
		expect(rows.map(r=>r.id)).toContain(n2.id);
		expect(rows.map(r=>r.id)).toContain(n3.id);
	}));

	it('should return notes matching any negated body', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'abc', body: 'def' });
		const n2 = await Note.save({ title: 'def', body: 'ghi' });
		const n3 = await Note.save({ title: 'ghi', body: 'jkl' });
		await engine.syncTables();

		rows = await engine.search('any:1 -body:xyz -body:ghi');
		expect(rows.length).toBe(3);
		expect(rows.map(r=>r.id)).toContain(n1.id);
		expect(rows.map(r=>r.id)).toContain(n2.id);
		expect(rows.map(r=>r.id)).toContain(n3.id);
	}));

	it('should support phrase search', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'foo beef', body: 'bar dog' });
		const n2 = await Note.save({ title: 'bar efgh', body: 'foo dog' });
		await engine.syncTables();

		rows = await engine.search('"bar dog"');
		expect(rows.length).toBe(1);
		expect(rows[0].id).toBe(n1.id);
	}));

	it('should support prefix search', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'foo beef', body: 'bar dog' });
		const n2 = await Note.save({ title: 'bar efgh', body: 'foo dog' });
		await engine.syncTables();

		rows = await engine.search('"bar*"');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);
	}));

	it('should support filtering by tags', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'But I would', body: 'walk 500 miles' });
		const n2 = await Note.save({ title: 'And I would', body: 'walk 500 more' });
		const n3 = await Note.save({ title: 'Just to be', body: 'the man who' });
		const n4 = await Note.save({ title: 'walked a thousand', body: 'miles to fall' });
		const n5 = await Note.save({ title: 'down at your', body: 'door' });

		await Tag.setNoteTagsByTitles(n1.id, ['Da', 'da', 'lat', 'da']);
		await Tag.setNoteTagsByTitles(n2.id, ['Da', 'da', 'lat', 'da']);

		await engine.syncTables();

		rows = await engine.search('tag:*');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('-tag:*');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n3.id);
		expect(ids(rows)).toContain(n4.id);
		expect(ids(rows)).toContain(n5.id);
	}));


	it('should support filtering by tags', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'peace talks', body: 'battle ground' });
		const n2 = await Note.save({ title: 'mouse', body: 'mister' });
		const n3 = await Note.save({ title: 'dresden files', body: 'harry dresden' });

		await Tag.setNoteTagsByTitles(n1.id, ['tag1', 'tag2']);
		await Tag.setNoteTagsByTitles(n2.id, ['tag2', 'tag3']);
		await Tag.setNoteTagsByTitles(n3.id, ['tag3', 'tag4', 'space travel']);

		await engine.syncTables();

		rows = await engine.search('tag:tag2');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('tag:tag2 tag:tag3');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('any:1 tag:tag1 tag:tag2 tag:tag3');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);

		rows = await engine.search('tag:tag2 tag:tag3 tag:tag4');
		expect(rows.length).toBe(0);

		rows = await engine.search('-tag:tag2');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n3.id);

		rows = await engine.search('-tag:tag2 -tag:tag3');
		expect(rows.length).toBe(0);

		rows = await engine.search('-tag:tag2 -tag:tag3');
		expect(rows.length).toBe(0);

		rows = await engine.search('any:1 -tag:tag2 -tag:tag3');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n3.id);

		rows = await engine.search('tag:"space travel"');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n3.id);
	}));

	it('should support filtering by notebook', (async () => {
		let rows;
		const folder0 = await Folder.save({ title: 'notebook0' });
		const folder1 = await Folder.save({ title: 'notebook1' });
		const notes0 = await createNTestNotes(5, folder0);
		const notes1 = await createNTestNotes(5, folder1);

		await engine.syncTables();

		rows = await engine.search('notebook:notebook0');
		expect(rows.length).toBe(5);
		expect(ids(rows).sort()).toEqual(ids(notes0).sort());

	}));

	it('should support filtering by nested notebook', (async () => {
		let rows;
		const folder0 = await Folder.save({ title: 'notebook0' });
		const folder00 = await Folder.save({ title: 'notebook00', parent_id: folder0.id });
		const folder1 = await Folder.save({ title: 'notebook1' });
		const notes0 = await createNTestNotes(5, folder0);
		const notes00 = await createNTestNotes(5, folder00);
		const notes1 = await createNTestNotes(5, folder1);

		await engine.syncTables();

		rows = await engine.search('notebook:notebook0');
		expect(rows.length).toBe(10);
		expect(ids(rows).sort()).toEqual(ids(notes0.concat(notes00)).sort());
	}));

	it('should support filtering by multiple notebooks', (async () => {
		let rows;
		const folder0 = await Folder.save({ title: 'notebook0' });
		const folder00 = await Folder.save({ title: 'notebook00', parent_id: folder0.id });
		const folder1 = await Folder.save({ title: 'notebook1' });
		const folder2 = await Folder.save({ title: 'notebook2' });
		const notes0 = await createNTestNotes(5, folder0);
		const notes00 = await createNTestNotes(5, folder00);
		const notes1 = await createNTestNotes(5, folder1);
		const notes2 = await createNTestNotes(5, folder2);

		await engine.syncTables();

		rows = await engine.search('notebook:notebook0 notebook:notebook1');
		expect(rows.length).toBe(15);
		expect(ids(rows).sort()).toEqual(ids(notes0).concat(ids(notes00).concat(ids(notes1))).sort());
	}));

	it('should support filtering by created date', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'I made this on', body: 'May 20 2020', user_created_time: Date.parse('2020-05-20') });
		const n2 = await Note.save({ title: 'I made this on', body: 'May 19 2020', user_created_time: Date.parse('2020-05-19') });
		const n3 = await Note.save({ title: 'I made this on', body: 'May 18 2020', user_created_time: Date.parse('2020-05-18') });

		await engine.syncTables();

		rows = await engine.search('created:20200520');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n1.id);

		rows = await engine.search('created:20200519');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('-created:20200519');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n3.id);

	}));

	it('should support filtering by between two dates', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'January 01 2020', body: 'January 01 2020', user_created_time: Date.parse('2020-01-01') });
		const n2 = await Note.save({ title: 'February 15 2020', body: 'February 15 2020', user_created_time: Date.parse('2020-02-15') });
		const n3 = await Note.save({ title: 'March 25 2019', body: 'March 25 2019', user_created_time: Date.parse('2019-03-25') });
		const n4 = await Note.save({ title: 'March 01 2018', body: 'March 01 2018', user_created_time: Date.parse('2018-03-01') });

		await engine.syncTables();

		rows = await engine.search('created:20200101 -created:20200220');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('created:201901 -created:202002');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n3.id);
		expect(ids(rows)).toContain(n1.id);

		rows = await engine.search('created:2018 -created:2019');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n4.id);
	}));

	it('should support filtering by created with smart value: day', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'I made this', body: 'today', user_created_time: parseInt(time.goBackInTime(Date.now(), 0, 'day'), 10) });
		const n2 = await Note.save({ title: 'I made this', body: 'yesterday', user_created_time: parseInt(time.goBackInTime(Date.now(), 1, 'day'), 10) });
		const n3 = await Note.save({ title: 'I made this', body: 'day before yesterday', user_created_time: parseInt(time.goBackInTime(Date.now(), 2, 'day'), 10) });

		await engine.syncTables();

		rows = await engine.search('created:day-0');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n1.id);

		rows = await engine.search('created:day-1');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('created:day-2');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);
	}));

	it('should support filtering by created with smart value: week', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'I made this', body: 'this week', user_created_time: parseInt(time.goBackInTime(Date.now(), 0, 'week'), 10) });
		const n2 = await Note.save({ title: 'I made this', body: 'the week before', user_created_time: parseInt(time.goBackInTime(Date.now(), 1, 'week'), 10) });
		const n3 = await Note.save({ title: 'I made this', body: 'before before week', user_created_time: parseInt(time.goBackInTime(Date.now(), 2, 'week'), 10) });

		await engine.syncTables();

		rows = await engine.search('created:week-0');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n1.id);

		rows = await engine.search('created:week-1');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('created:week-2');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);
	}));

	it('should support filtering by created with smart value: month', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'I made this', body: 'this month', user_created_time: parseInt(time.goBackInTime(Date.now(), 0, 'month'), 10) });
		const n2 = await Note.save({ title: 'I made this', body: 'the month before', user_created_time: parseInt(time.goBackInTime(Date.now(), 1, 'month'), 10) });
		const n3 = await Note.save({ title: 'I made this', body: 'before before month', user_created_time: parseInt(time.goBackInTime(Date.now(), 2, 'month'), 10) });

		await engine.syncTables();

		rows = await engine.search('created:month-0');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n1.id);

		rows = await engine.search('created:month-1');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('created:month-2');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);
	}));

	it('should support filtering by created with smart value: year', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'I made this', body: 'this year', user_created_time: parseInt(time.goBackInTime(Date.now(), 0, 'year'), 10) });
		const n2 = await Note.save({ title: 'I made this', body: 'the year before', user_created_time: parseInt(time.goBackInTime(Date.now(), 1, 'year'), 10) });
		const n3 = await Note.save({ title: 'I made this', body: 'before before year', user_created_time: parseInt(time.goBackInTime(Date.now(), 2, 'year'), 10) });

		await engine.syncTables();

		rows = await engine.search('created:year-0');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n1.id);

		rows = await engine.search('created:year-1');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('created:year-2');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);
	}));

	it('should support filtering by updated date', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'I updated this on', body: 'May 20 2020', updated_time: Date.parse('2020-05-20'), user_updated_time: Date.parse('2020-05-20') }, { autoTimestamp: false });
		const n2 = await Note.save({ title: 'I updated this on', body: 'May 19 2020', updated_time: Date.parse('2020-05-19'), user_updated_time: Date.parse('2020-05-19') }, { autoTimestamp: false });

		await engine.syncTables();

		rows = await engine.search('updated:20200520');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n1.id);

		rows = await engine.search('updated:20200519');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);
	}));

	it('should support filtering by updated with smart value: day', (async () => {
		let rows;
		const today = parseInt(time.goBackInTime(Date.now(), 0, 'day'), 10);
		const yesterday = parseInt(time.goBackInTime(Date.now(), 1, 'day'), 10);
		const dayBeforeYesterday = parseInt(time.goBackInTime(Date.now(), 2, 'day'), 10);
		const n1 = await Note.save({ title: 'I made this', body: 'today', updated_time: today, user_updated_time: today }, { autoTimestamp: false });
		const n11 = await Note.save({ title: 'I also made this', body: 'today', updated_time: today, user_updated_time: today }, { autoTimestamp: false });

		const n2 = await Note.save({ title: 'I made this', body: 'yesterday', updated_time: yesterday, user_updated_time: yesterday }, { autoTimestamp: false });
		const n3 = await Note.save({ title: 'I made this', body: 'day before yesterday', updated_time: dayBeforeYesterday ,user_updated_time: dayBeforeYesterday }, { autoTimestamp: false });

		await engine.syncTables();

		rows = await engine.search('updated:day-0');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n11.id);

		rows = await engine.search('updated:day-1');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n11.id);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('updated:day-2');
		expect(rows.length).toBe(4);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n11.id);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);
	}));

	it('should support filtering by type todo', (async () => {
		let rows;
		const t1 = await Note.save({ title: 'This is a ', body: 'todo', is_todo: 1 });
		const t2 = await Note.save({ title: 'This is another', body: 'todo but completed', is_todo: 1, todo_completed: 1590085027710 });
		const t3 = await Note.save({ title: 'This is NOT a ', body: 'todo' });

		await engine.syncTables();

		rows = await engine.search('type:todo');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(t1.id);
		expect(ids(rows)).toContain(t2.id);

		rows = await engine.search('any:1 type:todo');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(t1.id);
		expect(ids(rows)).toContain(t2.id);

		rows = await engine.search('iscompleted:1');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(t2.id);

		rows = await engine.search('iscompleted:0');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(t1.id);
	}));

	it('should support filtering by type note', (async () => {
		let rows;
		const t1 = await Note.save({ title: 'This is a ', body: 'todo', is_todo: 1 });
		const t2 = await Note.save({ title: 'This is another', body: 'todo but completed', is_todo: 1, todo_completed: 1590085027710 });
		const t3 = await Note.save({ title: 'This is NOT a ', body: 'todo' });

		await engine.syncTables();

		rows = await engine.search('type:note');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(t3.id);
	}));

	it('should support filtering by due date', (async () => {
		let rows;
		const toDo1 = await Note.save({ title: 'ToDo 1', body: 'todo', is_todo: 1, todo_due: Date.parse('2021-04-27') });
		const toDo2 = await Note.save({ title: 'ToDo 2', body: 'todo', is_todo: 1, todo_due: Date.parse('2021-03-17') });
		const note1 = await Note.save({ title: 'Note 1', body: 'Note' });

		await engine.syncTables();

		rows = await engine.search('due:20210425');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(toDo1.id);

		rows = await engine.search('-due:20210425');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(toDo2.id);
	}));

	it('should support filtering by due with smart value: day', (async () => {
		let rows;

		const inThreeDays = parseInt(time.goForwardInTime(Date.now(), 3, 'day'), 10);
		const inSevenDays = parseInt(time.goForwardInTime(Date.now(), 7, 'day'), 10);
		const threeDaysAgo = parseInt(time.goBackInTime(Date.now(), 3, 'day'), 10);
		const sevenDaysAgo = parseInt(time.goBackInTime(Date.now(), 7, 'day'), 10);

		const toDo1 = await Note.save({ title: 'ToDo + 3 day', body: 'toto', is_todo: 1, todo_due: inThreeDays });
		const toDo2 = await Note.save({ title: 'ToDo + 7 day', body: 'toto', is_todo: 1, todo_due: inSevenDays });
		const toDo3 = await Note.save({ title: 'ToDo - 3 day', body: 'toto', is_todo: 1, todo_due: threeDaysAgo });
		const toDo4 = await Note.save({ title: 'ToDo - 7 day', body: 'toto', is_todo: 1, todo_due: sevenDaysAgo });

		await engine.syncTables();

		rows = await engine.search('due:day-4');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(toDo1.id);
		expect(ids(rows)).toContain(toDo2.id);
		expect(ids(rows)).toContain(toDo3.id);

		rows = await engine.search('-due:day-4');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(toDo4.id);

		rows = await engine.search('-due:day+4');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(toDo1.id);
		expect(ids(rows)).toContain(toDo3.id);
		expect(ids(rows)).toContain(toDo4.id);

		rows = await engine.search('due:day+4');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(toDo2.id);

		rows = await engine.search('due:day-4 -due:day+4');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(toDo1.id);
		expect(ids(rows)).toContain(toDo3.id);
	}));

	it('should support filtering by latitude, longitude, altitude', (async () => {
		let rows;
		const n1 = await Note.save({ title: 'I made this', body: 'this week', latitude: 12.97, longitude: 88.88, altitude: 69.96 });
		const n2 = await Note.save({ title: 'I made this', body: 'the week before', latitude: 42.11, longitude: 77.77, altitude: 42.00 });
		const n3 = await Note.save({ title: 'I made this', body: 'before before week', latitude: 82.01, longitude: 66.66, altitude: 13.13 });

		await engine.syncTables();

		rows = await engine.search('latitude:13.5');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);

		rows = await engine.search('-latitude:40');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n1.id);

		rows = await engine.search('latitude:13 -latitude:80');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('altitude:13.5');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('-altitude:80.12');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);

		rows = await engine.search('longitude:70 -longitude:80');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('latitude:20 longitude:50 altitude:40');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('any:1 latitude:20 longitude:50 altitude:40');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);
	}));

	it('should support filtering by resource MIME type', (async () => {
		let rows;
		const service = new ResourceService();
		// console.log(testImagePath)
		const folder1 = await Folder.save({ title: 'folder1' });
		let n1 = await Note.save({ title: 'I have a picture', body: 'Im awesome', parent_id: folder1.id });
		const n2 = await Note.save({ title: 'Boring note 1', body: 'I just have text', parent_id: folder1.id });
		const n3 = await Note.save({ title: 'Boring note 2', body: 'me too', parent_id: folder1.id });
		let n4 = await Note.save({ title: 'A picture?', body: 'pfff, I have a pdf', parent_id: folder1.id });
		await engine.syncTables();

		// let note1 = await Note.save({ title: 'ma note', parent_id: folder1.id });
		n1 = await shim.attachFileToNote(n1, `${__dirname}/../tests/support/photo.jpg`);
		// const resource1 = (await Resource.all())[0];

		n4 = await shim.attachFileToNote(n4, `${__dirname}/../tests/support/welcome.pdf`);

		await service.indexNoteResources();

		rows = await engine.search('resource:image/jpeg');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n1.id);

		rows = await engine.search('resource:image/*');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n1.id);

		rows = await engine.search('resource:application/pdf');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n4.id);

		rows = await engine.search('-resource:image/jpeg');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);
		expect(ids(rows)).toContain(n4.id);

		rows = await engine.search('any:1 resource:application/pdf resource:image/jpeg');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n4.id);
	}));

	it('should ignore dashes in a word', (async () => {
		const n0 = await Note.save({ title: 'doesnotwork' });
		const n1 = await Note.save({ title: 'does not work' });
		const n2 = await Note.save({ title: 'does-not-work' });
		const n3 = await Note.save({ title: 'does_not_work' });

		await engine.syncTables();

		let rows = await engine.search('does-not-work');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);

		rows = await engine.search('does not work');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);

		rows = await engine.search('"does not work"');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);

		rows = await engine.search('title:does-not-work');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);

		rows = await engine.search('doesnotwork');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n0.id);

	}));

	it('should support filtering by sourceurl', (async () => {
		const n0 = await Note.save({ title: 'n0', source_url: 'https://discourse.joplinapp.org' });
		const n1 = await Note.save({ title: 'n1', source_url: 'https://google.com' });
		const n2 = await Note.save({ title: 'n2', source_url: 'https://reddit.com' });
		const n3 = await Note.save({ title: 'n3', source_url: 'https://joplinapp.org' });

		await engine.syncTables();

		let rows = await engine.search('sourceurl:https://joplinapp.org');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n3.id);

		rows = await engine.search('sourceurl:https://google.com');
		expect(rows.length).toBe(1);
		expect(ids(rows)).toContain(n1.id);

		rows = await engine.search('any:1 sourceurl:https://google.com sourceurl:https://reddit.com');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);

		rows = await engine.search('-sourceurl:https://google.com');
		expect(rows.length).toBe(3);
		expect(ids(rows)).toContain(n0.id);
		expect(ids(rows)).toContain(n2.id);
		expect(ids(rows)).toContain(n3.id);

		rows = await engine.search('sourceurl:*joplinapp.org');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n0.id);
		expect(ids(rows)).toContain(n3.id);

	}));

	it('should support negating notebooks', (async () => {

		const folder1 = await Folder.save({ title: 'folder1' });
		let n1 = await Note.save({ title: 'task1', body: 'foo', parent_id: folder1.id });
		let n2 = await Note.save({ title: 'task2', body: 'bar', parent_id: folder1.id });


		const folder2 = await Folder.save({ title: 'folder2' });
		let n3 = await Note.save({ title: 'task3', body: 'baz', parent_id: folder2.id });
		let n4 = await Note.save({ title: 'task4', body: 'blah', parent_id: folder2.id });


		await engine.syncTables();

		let rows = await engine.search('-notebook:folder1');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n3.id);
		expect(ids(rows)).toContain(n4.id);


		rows = await engine.search('-notebook:folder2');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);

	}));

	it('should support both inclusion and exclusion of notebooks together', (async () => {

		const parentFolder = await Folder.save({ title: 'parent' });
		let n1 = await Note.save({ title: 'task1', body: 'foo', parent_id: parentFolder.id });
		let n2 = await Note.save({ title: 'task2', body: 'bar', parent_id: parentFolder.id });


		const subFolder = await Folder.save({ title: 'child', parent_id: parentFolder.id });
		let n3 = await Note.save({ title: 'task3', body: 'baz', parent_id: subFolder.id });
		let n4 = await Note.save({ title: 'task4', body: 'blah', parent_id: subFolder.id });


		await engine.syncTables();

		let rows = await engine.search('notebook:parent -notebook:child');
		expect(rows.length).toBe(2);
		expect(ids(rows)).toContain(n1.id);
		expect(ids(rows)).toContain(n2.id);

	}));

	it('should support filtering by note id', (async () => {
		let rows;
		const note1 = await Note.save({ title: 'Note 1', body: 'body' });
		const note2 = await Note.save({ title: 'Note 2', body: 'body' });
		const note3 = await Note.save({ title: 'Note 3', body: 'body' });
		await engine.syncTables();

		rows = await engine.search(`id:${note1.id}`);
		expect(rows.length).toBe(1);
		expect(rows.map(r=>r.id)).toContain(note1.id);

		rows = await engine.search(`any:1 id:${note1.id} id:${note2.id}`);
		expect(rows.length).toBe(2);
		expect(rows.map(r=>r.id)).toContain(note1.id);
		expect(rows.map(r=>r.id)).toContain(note2.id);

		rows = await engine.search(`any:0 id:${note1.id} id:${note2.id}`);
		expect(rows.length).toBe(0);

		rows = await engine.search(`-id:${note2.id}`);
		expect(rows.length).toBe(2);
		expect(rows.map(r=>r.id)).toContain(note1.id);
		expect(rows.map(r=>r.id)).toContain(note3.id);
	}));

});
