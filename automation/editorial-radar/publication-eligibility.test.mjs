import test from 'node:test';
import assert from 'node:assert/strict';
import {isPublishableNews} from './publication-eligibility.mjs';

test('news_score 69 não é elegível',()=>assert.equal(isPublishableNews(69),false));
test('news_score 70 é elegível',()=>assert.equal(isPublishableNews(70),true));
test('news_score 80 continua elegível',()=>assert.equal(isPublishableNews(80),true));
