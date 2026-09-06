# Goal

My own doc. What I want out of building nomatch, and how I will know I got it.

## The short version

I want to understand how a search engine decides what comes back, at the level where I could rebuild the deciding part myself.

Shipping a Next app is not the test. I can already do that. The test is the retrieval layer underneath it.

## What I am testing

### Full-text search, all the way through

A search engine does not store your text. It cuts the text into pieces called tokens, and stores the pieces. When you search, it cuts your search the same way and compares piece to piece. Two words that look the same to a person can be two different tokens, and then nothing comes back.

I want to answer these without looking anything up:

- What a tokenizer does to a sentence, and where it decides one word ends and the next begins
- What each analysis option changes, and the order they run in
- Why a length limit counted in bytes is different from one counted in characters, and who that hurts
- Why a position is still spent when a filter throws the token away, and what breaks if it is not
- How BM25 turns a pile of matching documents into a ranked list, and what `k1`, `b` and `k3` each move

### Semantic search

The other half of the same subject. The text becomes a vector, the vector goes into an index, and results come back by distance instead of by exact match. The failures look nothing alike. Nothing is misspelled in a vector search. Things are just far apart.

I want the whole picture in my head: when exact matching is the right tool, when vectors are, and what a hybrid of the two is really doing when it merges two rankings.

v1 of nomatch does not build this part. It is full-text only, and that is deliberate, not an accident of running out of time.

### The part that is not code

Taking something invisible and putting it on a screen so that a person who has never heard the word "token" understands it in half a minute. If I can explain why a document is missing, in a sentence, in the interface, then I understood the pipeline. If I cannot, I did not.

## How I will know it worked

- I can open the tool, break a search on purpose, and the tool tells me which stage broke it before I work it out myself
- Every claim the interface makes has a test behind it, and the tests fail when the claim stops being true
- I can walk someone through the stage ladder out loud, with no notes, and defend every step
- The README tells the truth about what is mine and what is not

## What I am not testing

Not a distributed index. Not a storage engine. Not sharding, replication, or anything about running search at scale. Those are real problems and this is not the project where I learn them.

The subject here is one query against a small pile of documents, and every decision made between the two.
