import unittest

from split import split_evenly


class SplitTest(unittest.TestCase):
    def test_three_ways(self):
        self.assertEqual(split_evenly(100, 3), [34, 33, 33])

    def test_remainder_two(self):
        self.assertEqual(split_evenly(101, 3), [34, 34, 33])

    def test_zero(self):
        self.assertEqual(split_evenly(0, 2), [0, 0])


if __name__ == "__main__":
    unittest.main()
