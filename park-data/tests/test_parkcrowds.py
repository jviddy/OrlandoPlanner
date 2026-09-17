import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from parkdata.parkcrowds import Client, extract, mean, save, validate

class CalendarTests(unittest.TestCase):
    def setUp(self):
        self.e = json.loads((Path(__file__).parent / 'fixtures/parkcrowds_2025_sample.json').read_text())
        self.dates = {d['date'] for d in self.e['payload']['days']}
        self.rows = extract(self.e, self.dates, 'WDW')

    def test_values(self):
        self.assertEqual(len(self.rows['park_days']), 20)
        row = self.rows['resort_days'][0]
        self.assertEqual(row['average_wait_minutes'], 30)
        self.assertEqual(row['headliner_peak_minutes'], 45)
        self.assertEqual(mean([2, 3]), 3)
        self.assertEqual(row['crowd_status'], 'prediction')
        self.assertFalse(row['eligible_observed_training_target'])

    def test_events(self):
        self.assertEqual(len(self.rows['events']), 5)
        self.assertEqual([r['event_id'] for r in self.rows['events'] if r['date'] == '2025-01-08'], ['run_marathon'])
        self.assertFalse(any(r['date'] == '2025-01-13' for r in self.rows['events']))
        self.assertTrue(any(r['event_id'] == 'epcot_flower' for r in self.rows['events']))

    def test_hours_weather(self):
        r = next(r for r in self.rows['warnings'] if r['date'] == '2025-08-15' and r['park_key'] == 'MK')
        self.assertEqual(r['scheduledCloseLocal'], '18:00')
        self.assertIn('Halloween Party', r['reason'])
        self.assertIn('highTempF', self.rows['park_days'][0]['weather'])

    def test_missing_values(self):
        p = self.e['payload']['days'][0]['parks'][0]
        p['averageWait'] = None
        p['crowdLevelTenAverage'] = None
        r = extract(self.e, self.dates, 'WDW')['park_days'][0]
        self.assertIsNone(r['average_wait_minutes'])
        self.assertIsNone(r['crowd_level_average'])
        self.assertEqual(r['crowd_level_average_effective'], p['crowdLevelTen'])

    def test_validation(self):
        with self.assertRaises(ValueError): validate(self.e['payload'], 2024)
        p = copy.deepcopy(self.e['payload']); p['days'].append(p['days'][0])
        with self.assertRaises(ValueError): validate(p, 2025)
        p = copy.deepcopy(self.e['payload']); p['days'][0]['parks'][0]['averageWait'] = -1
        with self.assertRaises(ValueError): validate(p, 2025)

    def test_universal(self):
        rows = extract(self.e, self.dates, 'UOR')
        self.assertEqual(len(rows['park_days']), 15)
        self.assertTrue(next(r for r in rows['park_days'] if r['park_key'] == 'EPU')['pre_opening'])
        self.assertFalse(any(r['event_id'] == 'run_marathon' for r in rows['events']))

    def test_cache(self):
        with tempfile.TemporaryDirectory() as tmp:
            client = Client(tmp)
            with patch.object(client, 'request', side_effect=['User-agent: *\nAllow: /', json.dumps(self.e['payload'])]) as req:
                client.year(2025)
                self.assertEqual(req.call_count, 2)
            with patch.object(client, 'request', side_effect=AssertionError('Network used')): client.year(2025)
            with self.assertRaises(ValueError): Client(tmp, offline=True).year(2024)

    def test_blocked_and_fallback(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(Client, 'request', return_value='User-agent: *\nDisallow: /api/'):
                with self.assertRaises(ValueError): Client(tmp).year(2025)
            with patch.object(Client, 'request', side_effect=['User-agent: *\nAllow: /', '<html>dashboard</html>']):
                with self.assertRaises(ValueError): Client(tmp).year(2025)
            self.assertFalse((Path(tmp) / '2025.json').exists())

    def test_resume_coverage(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            save(self.rows, folder, self.dates, 'WDW', 0)
            before = (folder / 'park_days.csv').read_bytes()
            report = save(self.rows, folder, self.dates | {'2025-01-02'}, 'WDW', 0)
            self.assertEqual(before, (folder / 'park_days.csv').read_bytes())
            self.assertEqual(report['missing_park_dates']['MK'], ['2025-01-02'])
