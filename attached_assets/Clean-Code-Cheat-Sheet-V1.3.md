# Clean Code Cheat Sheet

```
C
l
e
a
n
 
C
o
d
e
 
V
 
1
.
3
S
m
e
l
l
s
P
r
a
c
t
i
c
e
s
E
x
c
e
p
t
i
o
n
 
H
a
n
d
l
i
n
g
U
s
i
n
g
 
E
x
c
e
p
t
i
o
n
s
 
f
o
r
 
C
o
n
t
r
o
l
 
F
l
o
w
U
s
i
n
g
 
e
x
c
e
p
t
i
o
n
s
 
f
o
r
 
c
o
n
t
r
o
l
 
f
l
o
w
:
 
h
a
s
 
b
a
d
 
p
e
r
f
o
r
m
a
n
c
e
,
 
i
s
 
h
a
r
d
 
t
o
 
u
n
d
e
r
s
t
a
n
d
,
 
r
e
s
u
l
t
s
 
i
n
 
v
e
r
y
 
h
a
r
d
 
h
a
n
d
l
i
n
g
 
o
f
 
r
e
a
l
 
e
x
c
e
p
t
i
o
n
a
l
 
c
a
s
e
s
.
C
a
t
c
h
 
S
p
e
c
i
f
i
c
 
E
x
c
e
p
t
i
o
n
s
C
a
t
c
h
 
e
x
c
e
p
t
i
o
n
s
 
a
s
 
s
p
e
c
i
f
i
c
 
a
s
 
p
o
s
s
i
b
l
e
.
 
C
a
t
c
h
 
o
n
l
y
 
t
h
e
 
e
x
c
e
p
t
i
o
n
s
 
f
o
r
 
w
h
i
c
h
 
y
o
u
 
c
a
n
 
r
e
a
c
t
 
m
e
a
n
i
n
g
f
u
l
.
C
a
t
c
h
 
E
x
c
e
p
t
i
o
n
s
 
W
h
e
r
e
 
Y
o
u
 
C
a
n
 
R
e
a
c
t
 
M
e
a
n
i
n
g
f
u
l
O
n
l
y
 
c
a
t
c
h
 
e
x
c
e
p
t
i
o
n
s
 
w
h
e
n
 
y
o
u
 
c
a
n
 
r
e
a
c
t
 
i
n
 
a
 
m
e
a
n
i
n
g
f
u
l
 
w
a
y
.
 
O
t
h
e
r
w
i
s
e
,
 
l
e
t
 
s
o
m
e
o
n
e
 
u
p
 
i
n
 
t
h
e
 
c
a
l
l
 
s
t
a
c
k
 
r
e
a
c
t
 
t
o
 
i
t
.
S
w
a
l
l
o
w
i
n
g
 
E
x
c
e
p
t
i
o
n
s
E
x
c
e
p
t
i
o
n
s
 
c
a
n
 
b
e
 
s
w
a
l
l
o
w
e
d
 
o
n
l
y
 
i
f
 
t
h
e
 
e
x
c
e
p
t
i
o
n
a
l
 
c
a
s
e
 
i
s
 
c
o
m
p
l
e
t
e
l
y
 
r
e
s
o
l
v
e
d
 
a
f
t
e
r
 
l
e
a
v
i
n
g
 
t
h
e
 
c
a
t
c
h
 
b
l
o
c
k
.
 
O
t
h
e
r
w
i
s
e
,
 
t
h
e
 
s
y
s
t
e
m
 
i
s
 
l
e
f
t
 
i
n
 
a
n
 
i
n
c
o
n
s
i
s
t
e
n
t
 
s
t
a
t
e
.
U
s
e
l
e
s
s
 
S
t
u
f
f
I
n
a
p
p
r
o
p
r
i
a
t
e
 
I
n
f
o
r
m
a
t
i
o
n
C
o
m
m
e
n
t
 
h
o
l
d
i
n
g
 
i
n
f
o
r
m
a
t
i
o
n
 
b
e
t
t
e
r
 
h
e
l
d
 
i
n
 
a
 
d
i
f
f
e
r
e
n
t
 
k
i
n
d
 
o
f
 
s
y
s
t
e
m
:
 
p
r
o
d
u
c
t
 
b
a
c
k
l
o
g
,
 
s
o
u
r
c
e
 
c
o
n
t
r
o
l
U
s
e
 
c
o
m
m
e
n
t
s
 
f
o
r
 
t
e
c
h
n
i
c
a
l
 
n
o
t
e
s
 
o
n
l
y
.
D
e
a
d
 
C
o
m
m
e
n
t
,
 
C
o
d
e
J
u
s
t
 
d
e
l
e
t
e
 
n
o
t
 
u
s
e
d
 
t
h
i
n
g
s
C
l
u
t
t
e
r
C
o
d
e
 
t
h
a
t
 
i
s
 
n
o
t
 
d
e
a
d
 
b
u
t
 
d
o
e
s
 
n
o
t
 
a
d
d
 
a
n
y
 
f
u
n
c
t
i
o
n
a
l
i
t
y
.
E
n
v
i
r
o
n
m
e
n
t
P
r
o
j
e
c
t
 
B
u
i
l
d
 
R
e
q
u
i
r
e
s
 
O
n
l
y
 
O
n
e
 
S
t
e
p
C
h
e
c
k
 
o
u
t
 
a
n
d
 
t
h
e
n
 
b
u
i
l
d
 
w
i
t
h
 
a
 
s
i
n
g
l
e
 
c
o
m
m
a
n
d
E
x
e
c
u
t
i
n
g
 
T
e
s
t
s
 
R
e
q
u
i
r
e
s
 
O
n
l
y
 
O
n
e
 
S
t
e
p
R
u
n
 
a
l
l
 
u
n
i
t
 
t
e
s
t
s
 
w
i
t
h
 
a
 
s
i
n
g
l
e
 
c
o
m
m
a
n
d
O
v
e
r
r
i
d
d
e
n
 
S
a
f
e
t
i
e
s
D
o
 
n
o
t
 
o
v
e
r
r
i
d
e
 
W
a
r
n
i
n
g
s
,
 
E
r
r
o
r
s
,
 
E
x
c
e
p
t
i
o
n
 
H
a
n
d
l
i
n
g
 
t
 
t
h
e
y
 
w
i
l
l
 
c
a
t
c
h
 
y
o
u
.
S
o
u
r
c
e
 
C
o
n
t
r
o
l
 
S
y
s
t
e
m
A
l
w
a
y
s
 
u
s
e
 
a
 
s
o
u
r
c
e
 
c
o
n
t
r
o
l
 
s
y
s
t
e
m
.
C
o
n
t
i
n
u
o
u
s
 
I
n
t
e
g
r
a
t
i
o
n
A
s
s
u
r
e
 
i
n
t
e
g
r
i
t
y
 
w
i
t
h
 
C
o
n
t
i
n
u
o
u
s
 
I
n
t
e
g
r
a
t
i
o
n
M
e
t
h
o
d
s
M
e
t
h
o
d
 
W
i
t
h
 
T
o
o
 
M
a
n
y
 
A
r
g
u
m
e
n
t
s
P
r
e
f
e
r
 
l
e
s
s
 
a
r
g
u
m
e
n
t
s
.
 
M
a
y
b
e
 
f
u
n
c
t
i
o
n
a
l
i
t
y
 
c
a
n
 
b
e
 
o
u
t
s
o
u
r
c
e
d
 
t
o
 
d
e
d
i
c
a
t
e
d
 
c
l
a
s
s
 
t
h
a
t
 
h
o
l
d
s
 
t
h
e
 
i
n
f
o
r
m
a
t
i
o
n
 
i
n
 
f
i
e
l
d
s
.
M
e
t
h
o
d
 
W
i
t
h
 
O
u
t
/
R
e
f
 
A
r
g
u
m
e
n
t
s
P
r
e
v
e
n
t
 
u
s
a
g
e
.
 
R
e
t
u
r
n
 
c
o
m
p
l
e
x
 
o
b
j
e
c
t
 
h
o
l
d
i
n
g
 
a
l
l
 
v
a
l
u
e
s
,
 
s
p
l
i
t
 
i
n
t
o
 
s
e
v
e
r
a
l
 
m
e
t
h
o
d
s
.
 
I
f
 
y
o
u
r
 
m
e
t
h
o
d
 
m
u
s
t
 
c
h
a
n
g
e
 
t
h
e
 
s
t
a
t
e
 
o
f
 
s
o
m
e
t
h
i
n
g
,
 
h
a
v
e
 
i
t
 
c
h
a
n
g
e
 
t
h
e
 
s
t
a
t
e
 
o
f
 
t
h
e
 
o
b
j
e
c
t
 
i
t
 
i
s
 
c
a
l
l
e
d
 
o
n
.
S
e
l
e
c
t
o
r
 
/
 
F
l
a
g
 
A
r
g
u
m
e
n
t
s
p
u
b
l
i
c
 
i
n
t
 
F
o
o
(
b
o
o
l
 
f
l
a
g
)
s
p
l
i
t
 
m
e
t
h
o
d
 
i
n
t
o
 
s
e
v
e
r
a
l
 
i
n
d
e
p
e
n
d
e
n
t
 
m
e
t
h
o
d
s
 
t
h
a
t
 
c
a
n
 
b
e
 
c
a
l
l
e
d
 
f
r
o
m
 
t
h
e
 
c
l
i
e
n
t
 
w
i
t
h
o
u
t
 
t
h
e
 
f
l
a
g
.
M
e
t
h
o
d
s
 
S
h
o
u
l
d
 
D
o
 
O
n
e
 
T
h
i
n
g
l
o
o
p
s
,
 
e
x
c
e
p
t
i
o
n
 
h
a
n
d
l
i
n
g
,
 
Y
e
n
c
a
p
s
u
l
a
t
e
 
i
n
 
s
u
b
-
m
e
t
h
o
d
s
M
e
t
h
o
d
s
 
S
h
o
u
l
d
 
D
e
s
c
e
n
d
 
1
 
L
e
v
e
l
 
O
f
 
A
b
s
t
r
a
c
t
i
o
n
T
h
e
 
s
t
a
t
e
m
e
n
t
s
 
w
i
t
h
i
n
 
a
 
m
e
t
h
o
d
 
s
h
o
u
l
d
 
a
l
l
 
b
e
 
w
r
i
t
t
e
n
 
a
t
 
t
h
e
 
s
a
m
e
 
l
e
v
e
l
 
o
f
 
a
b
s
t
r
a
c
t
i
o
n
,
 
w
h
i
c
h
 
s
h
o
u
l
d
 
b
e
 
o
n
e
 
l
e
v
e
l
 
b
e
l
o
w
 
t
h
e
 
o
p
e
r
a
t
i
o
n
 
d
e
s
c
r
i
b
e
d
 
b
y
 
t
h
e
 
n
a
m
e
 
o
f
 
t
h
e
 
f
u
n
c
t
i
o
n
.
I
n
a
p
p
r
o
p
r
i
a
t
e
 
S
t
a
t
i
c
S
t
a
t
i
c
 
m
e
t
h
o
d
 
t
h
a
t
 
s
h
o
u
l
d
 
b
e
 
a
n
 
i
n
s
t
a
n
c
e
 
m
e
t
h
o
d
.
U
n
d
e
r
s
t
a
n
d
a
b
i
l
i
t
y
P
o
o
r
l
y
 
W
r
i
t
t
e
n
 
C
o
m
m
e
n
t
C
o
m
m
e
n
t
 
d
o
e
s
 
n
o
t
 
a
d
d
 
a
n
y
 
v
a
l
u
e
 
(
r
e
d
u
n
d
a
n
t
 
t
o
 
c
o
d
e
)
,
 
i
s
 
n
o
t
 
w
e
l
l
 
f
o
r
m
e
d
,
 
n
o
t
 
c
o
r
r
e
c
t
 
g
r
a
m
m
a
r
/
s
p
e
l
l
i
n
g
O
b
v
i
o
u
s
 
B
e
h
a
v
i
o
u
r
 
I
s
 
U
n
i
m
p
l
e
m
e
n
t
e
d
]
}
o

ı
]
}
v
’
}
(
^
ı
Z
˚
„
]
v

]
›
o
˚
}
(
˚

’
ı
’
ı
}
v
]
’
Z
u
˚
v
ı
_
W
h
a
t
 
y
o
u
 
e
x
p
e
c
t
 
i
s
 
w
h
a
t
 
y
o
u
 
g
e
t
C
o
n
s
i
s
t
e
n
c
y
I
f
 
y
o
u
 
d
o
 
s
o
m
e
t
h
i
n
g
 
a
 
c
e
r
t
a
i
n
 
w
a
y
,
 
d
o
 
a
l
l
 
s
i
m
i
l
a
r
 
t
h
i
n
g
s
 
i
n
 
t
h
e
 
s
a
m
e
 
w
a
y
:
 
s
a
m
e
 
v
a
r
i
a
b
l
e
 
n
a
m
e
 
f
o
r
 
s
a
m
e
 
c
o
n
c
e
p
t
s
,
 
s
a
m
e
 
n
a
m
i
n
g
 
p
a
t
t
e
r
n
 
f
o
r
 
c
o
r
r
e
s
p
o
n
d
i
n
g
 
c
o
n
c
e
p
t
s
O
b
s
c
u
r
e
d
 
I
n
t
e
n
t
T
o
o
 
d
e
n
s
e
 
a
l
g
o
r
i
t
h
m
s
 
t
h
a
t
 
l
o
o
s
e
 
a
l
l
 
e
x
p
r
e
s
s
i
v
n
e
s
s
.
H
i
d
d
e
n
 
L
o
g
i
c
a
l
 
D
e
p
e
n
d
e
n
c
y
A
 
m
e
t
h
o
d
 
c
a
n
 
o
n
l
y
 
w
o
r
k
 
c
o
r
r
e
c
t
l
y
 
w
h
e
n
 
i
n
v
o
k
e
d
 
c
o
r
r
e
c
t
l
y
 
d
e
p
e
n
d
i
n
g
 
o
n
 
s
o
m
e
t
h
i
n
g
 
e
l
s
e
 
i
n
 
t
h
e
 
s
a
m
e
 
c
l
a
s
s
,
 
e
.
g
.
 
a
 
D
e
l
e
t
e
I
t
e
m
 
m
e
t
h
o
d
 
m
u
s
t
 
o
n
l
y
 
b
e
 
c
a
l
l
e
d
 
i
f
 
a
 
C
a
n
D
e
l
e
t
e
I
t
e
m
 
m
e
t
h
o
d
 
r
e
t
u
r
n
e
d
 
t
r
u
e
,
 
o
t
h
e
r
w
i
s
e
 
i
t
 
w
i
l
l
 
f
a
i
l
.
N
a
m
i
n
g
C
h
o
o
s
e
 
D
e
s
c
r
i
p
t
i
v
e
 
/
 
U
n
a
m
b
i
g
u
o
u
s
 
N
a
m
e
s
N
a
m
e
s
 
h
a
v
e
 
t
o
 
r
e
f
l
e
c
t
 
w
h
a
t
 
a
 
v
a
r
i
a
b
l
e
,
 
f
i
e
l
d
,
 
p
r
o
p
e
r
t
y
 
s
t
a
n
d
s
 
f
o
r
.
 
N
a
m
e
s
 
h
a
v
e
 
t
o
 
b
e
 
p
r
e
c
i
s
e
.
C
h
o
o
s
e
 
N
a
m
e
s
 
A
t
 
A
p
p
r
o
p
r
i
a
t
e
 
L
e
v
e
l
 
O
f
 
A
b
s
t
r
a
c
t
i
o
n
C
h
o
o
s
e
 
n
a
m
e
s
 
t
h
a
t
 
r
e
f
l
e
c
t
 
t
h
e
 
l
e
v
e
l
 
o
f
 
a
b
s
t
r
a
c
t
i
o
n
 
o
f
 
t
h
e
 
c
l
a
s
s
 
o
r
 
m
e
t
h
o
d
 
y
o
u
 
a
r
e
 
w
o
r
k
i
n
g
 
i
n
.
U
s
e
 
L
o
n
g
 
N
a
m
e
s
 
F
o
r
 
L
o
n
g
 
S
c
o
p
e
s
f
i
e
l
d
s
 
 
 
p
a
r
a
m
e
t
e
r
s
 
 
 
l
o
c
a
l
s
 
 
 
l
o
o
p
 
v
a
r
i
a
b
l
e
s
l
o
n
g
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
s
h
o
r
t
A
v
o
i
d
 
E
n
c
o
d
i
n
g
s
 
I
n
 
N
a
m
e
s
N
o
 
p
r
e
f
i
x
e
s
,
 
n
o
 
t
y
p
e
/
s
c
o
p
e
 
i
n
f
o
r
m
a
t
i
o
n
U
s
e
 
S
t
a
n
d
a
r
d
 
N
o
m
e
n
c
l
a
t
u
r
e
 
W
h
e
r
e
 
P
o
s
s
i
b
l
e
N
a
m
e
s
 
S
h
o
u
l
d
 
D
e
s
c
r
i
b
e
 
S
i
d
e
-
E
f
f
e
c
t
s
N
a
m
e
s
 
h
a
v
e
 
t
o
 
r
e
f
l
e
c
t
 
t
h
e
 
e
n
t
i
r
e
 
f
u
n
c
t
i
o
n
a
l
i
t
y
.
N
a
m
e
 
I
n
t
e
r
f
a
c
e
s
 
A
f
t
e
r
 
F
u
n
c
t
i
o
n
a
l
i
t
y
 
T
h
e
y
 
A
b
s
t
r
a
c
t
T
h
e
 
n
a
m
e
 
o
f
 
a
n
 
i
n
t
e
r
f
a
c
e
 
s
h
o
u
l
d
 
b
e
 
d
e
r
i
v
e
d
 
f
r
o
m
 
i
s
t
 
u
s
a
g
e
 
b
y
 
t
h
e
 
c
l
i
e
n
t
,
 
l
i
k
e
 
I
S
t
r
e
a
m
.
N
a
m
e
 
C
l
a
s
s
e
s
 
A
f
t
e
r
 
I
m
p
l
e
m
e
n
t
a
t
i
o
n
T
h
e
 
n
a
m
e
 
o
f
 
a
 
c
l
a
s
s
 
s
h
o
u
l
d
 
r
e
f
l
e
c
t
 
h
o
w
 
i
t
 
f
u
l
f
i
l
l
s
 
t
h
e
 
f
u
n
c
t
i
o
n
a
l
i
t
y
 
p
r
o
v
i
d
e
d
 
b
y
 
i
t
s
 
i
n
t
e
r
f
a
c
e
(
s
)
,
 
l
i
k
e
 
M
e
m
o
r
y
S
t
r
e
a
m
 
:
 
I
S
t
r
e
a
m
S
o
u
r
c
e
 
L
a
y
o
u
t
U
s
e
 
E
x
p
l
a
n
a
t
o
r
y
 
V
a
r
i
a
b
l
e
s
U
s
e
 
l
o
c
a
l
s
 
t
o
 
g
i
v
e
 
s
t
e
p
s
 
i
n
 
a
l
g
o
r
i
t
h
m
s
 
n
a
m
e
s
.
V
e
r
t
i
c
a
l
 
S
e
p
a
r
a
t
i
o
n
V
a
r
i
a
b
l
e
s
 
a
n
d
 
m
e
t
h
o
d
s
 
s
h
o
u
l
d
 
b
e
 
d
e
f
i
n
e
d
 
c
l
o
s
e
 
t
o
 
w
h
e
r
e
 
t
h
e
y
 
a
r
e
 
u
s
e
d
.
 
L
o
c
a
l
 
v
a
r
i
a
b
l
e
s
 
s
h
o
u
l
d
 
b
e
 
d
e
c
l
a
r
e
d
 
j
u
s
t
 
a
b
o
v
e
 
t
h
e
i
r
 
f
i
r
s
t
 
u
s
a
g
e
 
a
n
d
 
s
h
o
u
l
d
 
h
a
v
e
 
a
 
s
m
a
l
l
 
v
e
r
t
i
c
a
l
 
s
c
o
p
e
.
D
e
p
e
n
d
e
n
c
y
 
I
n
j
e
c
t
i
o
n
D
e
c
o
u
p
l
e
 
C
o
n
s
t
r
u
c
t
i
o
n
 
f
r
o
m
 
R
u
n
t
i
m
e
D
e
c
o
u
p
l
i
n
g
 
t
h
e
 
c
o
n
s
t
r
u
c
t
i
o
n
 
p
h
a
s
e
 
c
o
m
p
l
e
t
e
l
y
 
f
r
o
m
 
t
h
e
 
r
u
n
t
i
m
e
 
h
e
l
p
s
 
t
o
 
s
i
m
p
l
i
f
y
 
u
n
i
t
 
t
e
s
t
s
.
D
e
p
e
n
d
e
n
c
i
e
s
B
a
s
e
 
C
l
a
s
s
e
s
 
D
e
p
e
n
d
i
n
g
 
O
n
 
T
h
e
i
r
 
D
e
r
i
v
a
t
i
v
e
s
B
a
s
e
 
c
l
a
s
s
e
s
 
s
h
o
u
l
d
 
w
o
r
k
 
w
i
t
h
 
a
n
y
 
d
e
r
i
v
e
d
 
c
l
a
s
s
.
T
o
o
 
M
u
c
h
 
I
n
f
o
r
m
a
t
i
o
n
m
i
n
i
m
i
z
e
 
i
n
t
e
r
f
a
c
e
 
t
o
 
m
i
n
i
m
i
z
e
 
c
o
u
p
l
i
n
g
F
e
a
t
u
r
e
 
E
n
v
y
T
h
e
 
m
e
t
h
o
d
s
 
o
f
 
a
 
c
l
a
s
s
 
s
h
o
u
l
d
 
b
e
 
i
n
t
e
r
e
s
t
e
d
 
i
n
 
t
h
e
 
v
a
r
i
a
b
l
e
s
 
a
n
d
 
f
u
n
c
t
i
o
n
s
 
o
f
 
t
h
e
 
c
l
a
s
s
 
t
h
e
y
 
b
e
l
o
n
g
 
t
o
,
 
a
n
d
 
n
o
t
 
t
h
e
 
v
a
r
i
a
b
l
e
s
 
a
n
d
 
f
u
n
c
t
i
o
n
s
 
o
f
 
o
t
h
e
r
 
c
l
a
s
s
e
s
.
 
W
h
e
n
 
a
 
m
e
t
h
o
d
 
u
s
e
s
 
a
c
c
e
s
s
o
r
s
 
a
n
d
 
m
u
t
a
t
o
r
s
 
o
f
 
s
o
m
e
 
o
t
h
e
r
 
o
b
j
e
c
t
 
t
o
 
m
a
n
i
p
u
l
a
t
e
 
t
h
e
 
d
a
t
a
 
w
i
t
h
i
n
 
t
h
a
t
 
o
b
j
e
c
t
,
 
t
h
e
n
 
i
t
 
e
n
v
i
e
s
 
t
h
e
 
s
c
o
p
e
 
o
f
 
t
h
e
 
c
l
a
s
s
 
o
f
 
t
h
a
t
 
o
t
h
e
r
 
o
b
j
e
c
t
.
 
I
t
 
w
i
s
h
e
s
 
t
h
a
t
 
i
t
 
w
e
r
e
 
i
n
s
i
d
e
 
t
h
a
t
 
o
t
h
e
r
 
c
l
a
s
s
 
s
o
 
t
h
a
t
 
i
t
 
c
o
u
l
d
 
h
a
v
e
 
d
i
r
e
c
t
 
a
c
c
e
s
s
 
t
o
 
t
h
e
 
v
a
r
i
a
b
l
e
s
 
i
t
 
i
s
 
m
a
n
i
p
u
l
a
t
i
n
g
.
A
r
t
i
f
i
c
i
a
l
 
C
o
u
p
l
i
n
g
Z
]
v
P
’
ı
Z

ı
ˆ
}
v
[
ı
ˆ
˚
›
˚
v
ˆ
µ
›
}
v
˚


Z
}
ı
Z
˚
„
’
Z
}
µ
o
ˆ
v
}
ı

˚

„
ı
]
(
]

]

o
o
Ç
c
o
u
p
l
e
d
.
M
a
k
e
 
L
o
g
i
c
a
l
 
D
e
p
e
n
d
e
n
c
i
e
s
 
P
h
y
s
i
c
a
l
I
f
 
o
n
e
 
m
o
d
u
l
e
 
d
e
p
e
n
d
s
 
u
p
o
n
 
a
n
o
t
h
e
r
,
 
t
h
a
t
 
d
e
p
e
n
d
e
n
c
y
 
s
h
o
u
l
d
 
b
e
 
p
h
y
s
i
c
a
l
,
 
n
o
t
 
j
u
s
t
 
l
o
g
i
c
a
l
.
 
}
v
[
ı
u

l
˚

’
’
µ
u
›
ı
]
}
v
’
.
H
i
d
d
e
n
 
T
e
m
p
o
r
a
l
 
C
o
u
p
l
i
n
g
I
f
 
f
o
r
 
e
x
a
m
p
l
e
 
t
h
e
 
o
r
d
e
r
 
o
f
 
s
o
m
e
 
m
e
t
h
o
d
 
c
a
l
l
s
 
i
s
 
i
m
p
o
r
t
a
n
t
 
t
h
e
n
 
m
a
k
e
 
s
u
r
e
 
t
h
a
t
 
t
h
e
y
 
c
a
n
n
o
t
 
b
e
 
c
a
l
l
e
d
 
i
n
 
t
h
e
 
w
r
o
n
g
 
o
r
d
e
r
.
A
v
o
i
d
 
T
r
a
n
s
i
t
i
v
e
 
N
a
v
i
g
a
t
i
o
n
a
k
a
 
L
a
w
 
o
f
 
D
e
m
e
t
e
r
,
 
W
r
i
t
i
n
g
 
s
h
y
 
c
o
d
e
A
 
m
o
d
u
l
e
 
s
h
o
u
l
d
 
k
n
o
w
 
o
n
l
y
 
i
t
s
 
d
i
r
e
c
t
 
d
e
p
e
n
d
e
n
c
i
e
s
.
S
i
n
g
l
e
t
o
n
s
 
/
 
S
e
r
v
i
c
e
 
L
o
c
a
t
o
r
U
s
e
 
d
e
p
e
n
d
e
n
c
y
 
i
n
j
e
c
t
i
o
n
.
 
S
i
n
g
l
e
t
o
n
s
 
h
i
d
e
 
d
e
p
e
n
d
e
n
c
i
e
s
.
D
e
s
i
g
n
C
o
d
e
 
A
t
 
W
r
o
n
g
 
L
e
v
e
l
 
O
f
 
A
b
s
t
r
a
c
t
i
o
n
F
u
n
c
t
i
o
n
a
l
i
t
y
 
i
s
 
a
t
 
w
r
o
n
g
 
l
e
v
e
l
 
o
f
 
a
b
s
t
r
a
c
t
i
o
n
,
 
e
.
g
.
 
a
 
P
e
r
c
e
n
t
a
g
e
F
u
l
l
 
p
r
o
p
e
r
t
y
 
o
n
 
a
 
g
e
n
e
r
i
c
 
I
S
t
a
c
k
<
T
>
.
M
i
s
p
l
a
c
e
d
 
R
e
s
p
o
n
s
i
b
i
l
i
t
y
S
o
m
e
t
h
i
n
g
 
p
u
t
 
i
n
 
t
h
e
 
w
r
o
n
g
 
p
l
a
c
e
.
S
t
r
u
c
t
u
r
e
 
O
v
e
r
 
C
o
n
v
e
n
t
i
o
n
E
n
f
o
r
c
e
 
d
e
s
i
g
n
 
d
e
c
i
s
i
o
n
s
 
w
i
t
h
 
s
t
r
u
c
t
u
r
e
 
o
v
e
r
 
c
o
n
v
e
n
t
i
o
n
.
 
N
a
m
i
n
g
 
c
o
n
v
e
n
t
i
o
n
s
 
a
r
e
 
g
o
o
d
,
 
b
u
t
 
t
h
e
y
 
a
r
e
 
i
n
f
e
r
i
o
r
 
t
o
 
s
t
r
u
c
t
u
r
e
s
 
t
h
a
t
 
f
o
r
c
e
 
c
o
m
p
l
i
a
n
c
e
.
}
v
[
ı
˚
„

]
ı
„

„
Ç
H
a
v
e
 
a
 
r
e
a
s
o
n
 
f
o
r
 
t
h
e
 
w
a
y
 
y
o
u
 
s
t
r
u
c
t
u
r
e
 
y
o
u
r
 
c
o
d
e
,
 
a
n
d
 
m
a
k
e
 
s
u
r
e
 
t
h
a
t
 
r
e
a
s
o
n
 
i
s
 
c
o
m
m
u
n
i
c
a
t
e
d
 
b
y
 
t
h
e
 
s
t
r
u
c
t
u
r
e
 
o
f
 
t
h
e
 
c
o
d
e
.
 
I
f
 
a
 
s
t
r
u
c
t
u
r
e
 
a
p
p
e
a
r
s
 
a
r
b
i
t
r
a
r
y
,
 
o
t
h
e
r
s
 
w
i
l
l
 
f
e
e
l
 
e
m
p
o
w
e
r
e
d
 
t
o
 
c
h
a
n
g
e
 
i
t
.
K
e
e
p
 
C
o
n
f
i
g
u
r
a
b
l
e
 
D
a
t
a
 
A
t
 
H
i
g
h
 
L
e
v
e
l
s
I
f
 
y
o
u
 
h
a
v
e
 
a
 
c
o
n
s
t
a
n
t
 
s
u
c
h
 
a
s
 
d
e
f
a
u
l
t
 
o
r
 
c
o
n
f
i
g
u
r
a
t
i
o
n
 
v
a
l
u
e
 
t
h
a
t
 
i
s
 
k
n
o
w
n
 
a
n
d
 
e
x
p
e
c
t
e
d
 
a
t
 
a
 
h
i
g
h
 
l
e
v
e
l
 
o
f
 
a
b
s
t
r
a
c
t
i
o
n
,
 
d
o
 
n
o
t
 
b
u
r
y
 
i
t
 
i
n
 
a
 
l
o
w
-
l
e
v
e
l
 
f
u
n
c
t
i
o
n
.
 
E
x
p
o
s
e
 
i
t
 
a
s
 
a
n
 
a
r
g
u
m
e
n
t
 
t
o
 
t
h
e
 
l
o
w
-
l
e
v
e
l
 
f
u
n
c
t
i
o
n
 
c
a
l
l
e
d
 
f
r
o
m
 
t
h
e
 
h
i
g
h
-
l
e
v
e
l
 
f
u
n
c
t
i
o
n
.
P
r
e
f
e
r
 
P
o
l
y
m
o
r
p
h
i
s
m
 
T
o
 
I
f
/
E
l
s
e
 
O
r
 
S
w
i
t
c
h
/
C
a
s
e
^
_
:
 
T
h
e
r
e
 
m
a
y
 
b
e
 
n
o
 
m
o
r
e
 
t
h
a
n
 
o
n
e
 
s
w
i
t
c
h
 
s
t
a
t
e
m
e
n
t
 
f
o
r
 
a
 
g
i
v
e
n
 
t
y
p
e
 
o
f
 
s
e
l
e
c
t
i
o
n
.
 
T
h
e
 
c
a
s
e
s
 
i
n
 
t
h
a
t
 
s
w
i
t
c
h
 
s
t
a
t
e
m
e
n
t
 
m
u
s
t
 
c
r
e
a
t
e
 
p
o
l
y
m
o
r
p
h
i
c
 
o
b
j
e
c
t
s
 
t
h
a
t
 
t
a
k
e
 
t
h
e
 
p
l
a
c
e
 
o
f
 
o
t
h
e
r
 
s
u
c
h
 
s
w
i
t
c
h
 
s
t
a
t
e
m
e
n
t
s
 
i
n
 
t
h
e
 
r
e
s
t
 
o
f
 
t
h
e
 
s
y
s
t
e
m
.
B
e
 
P
r
e
c
i
s
e
W
h
e
n
 
y
o
u
 
m
a
k
e
 
a
 
d
e
c
i
s
i
o
n
 
i
n
 
y
o
u
r
 
c
o
d
e
,
 
m
a
k
e
 
s
u
r
e
 
y
o
u
 
m
a
k
e
 
i
t
 
p
r
e
c
i
s
e
l
y
.
 
K
n
o
w
 
w
h
y
 
y
o
u
 
h
a
v
e
 
m
a
d
e
 
i
t
 
a
n
d
 
h
o
w
 
y
o
u
 
w
i
l
l
 
d
e
a
l
 
w
i
t
h
 
a
n
y
 
e
x
c
e
p
t
i
o
n
s
.
F
i
e
l
d
s
 
N
o
t
 
D
e
f
i
n
i
n
g
 
S
t
a
t
e
F
i
e
l
d
s
 
h
o
l
d
i
n
g
 
d
a
t
a
 
t
h
a
t
 
d
o
e
s
 
n
o
t
 
b
e
l
o
n
g
 
t
o
 
t
h
e
 
s
t
a
t
e
 
o
f
 
t
h
e
 
i
n
s
t
a
n
c
e
 
b
u
t
 
a
r
e
 
u
s
e
d
 
t
o
 
h
o
l
d
 
t
e
m
p
o
r
a
r
y
 
d
a
t
a
.
 
U
s
e
 
l
o
c
a
l
 
v
a
r
i
a
b
l
e
s
 
o
r
 
e
x
t
r
a
c
t
 
t
o
 
c
l
a
s
s
 
a
b
s
t
r
a
c
t
i
o
n
 
t
h
e
 
p
e
r
f
o
r
m
e
d
 
a
c
t
i
o
n
.
O
v
e
r
 
C
o
n
f
i
g
u
r
a
b
i
l
i
t
y
P
r
e
v
e
n
t
 
c
o
n
f
i
g
u
r
a
t
i
o
n
 
j
u
s
t
 
f
o
r
 
t
h
e
 
s
a
k
e
 
o
f
 
i
t
 
t
 
o
r
 
b
e
c
a
u
s
e
 
n
o
b
o
d
y
 
c
a
n
 
d
e
c
i
d
e
 
h
o
w
 
i
t
 
s
h
o
u
l
d
 
b
e
.
 
O
t
h
e
r
w
i
s
e
,
 
t
h
i
s
 
w
i
l
l
 
r
e
s
u
l
t
 
i
n
 
t
o
o
 
c
o
m
p
l
e
x
,
 
i
n
s
t
a
b
i
l
e
 
s
y
s
t
e
m
s
.
S
y
m
m
e
t
r
y
 
/
 
A
n
a
l
o
g
y
F
a
v
o
u
r
 
s
y
m
m
e
t
r
i
c
 
d
e
s
i
g
n
s
 
(
e
.
g
.
 
L
o
a
d
 
t
 
S
a
f
e
)
 
a
n
d
 
d
e
s
i
g
n
s
 
t
h
e
 
f
o
l
l
o
w
 
a
n
a
l
o
g
i
e
s
 
(
e
.
g
.
 
s
a
m
e
 
d
e
s
i
g
n
 
a
s
 
f
o
u
n
d
 
i
n
 
.
N
E
T
 
f
r
a
m
e
w
o
r
k
)
.
C
l
a
s
s
 
D
e
s
i
g
n
S
i
n
g
l
e
 
R
e
s
p
o
n
s
i
b
i
l
i
t
y
 
P
r
i
n
c
i
p
l
e
 
(
S
R
P
)
A
 
c
l
a
s
s
 
s
h
o
u
l
d
 
h
a
v
e
 
o
n
e
,
 
a
n
d
 
o
n
l
y
 
o
n
e
,
 
r
e
a
s
o
n
 
t
o
 
c
h
a
n
g
e
.
O
p
e
n
 
C
l
o
s
e
d
 
P
r
i
n
c
i
p
l
e
 
(
O
C
P
)
Y
o
u
 
s
h
o
u
l
d
 
b
e
 
a
b
l
e
 
t
o
 
e
x
t
e
n
d
 
a
 
c
l
a
s
s
e
s
 
b
e
h
a
v
i
o
r
,
 
w
i
t
h
o
u
t
 
m
o
d
i
f
y
i
n
g
 
i
t
.
L
i
s
k
o
v
 
S
u
b
s
t
i
t
u
t
i
o
n
 
P
r
i
n
c
i
p
l
e
 
(
L
S
P
)
D
e
r
i
v
e
d
 
c
l
a
s
s
e
s
 
m
u
s
t
 
b
e
 
s
u
b
s
t
i
t
u
t
a
b
l
e
 
f
o
r
 
t
h
e
i
r
 
b
a
s
e
 
c
l
a
s
s
e
s
.
D
e
p
e
n
d
e
n
c
y
 
I
n
v
e
r
s
i
o
n
 
P
r
i
n
c
i
p
l
e
 
(
D
I
P
)
D
e
p
e
n
d
 
o
n
 
a
b
s
t
r
a
c
t
i
o
n
s
,
 
n
o
t
 
o
n
 
c
o
n
c
r
e
t
i
o
n
s
.
I
n
t
e
r
f
a
c
e
 
S
e
g
r
e
g
a
t
i
o
n
 
P
r
i
n
c
i
p
l
e
 
(
I
S
P
)
M
a
k
e
 
f
i
n
e
 
g
r
a
i
n
e
d
 
i
n
t
e
r
f
a
c
e
s
 
t
h
a
t
 
a
r
e
 
c
l
i
e
n
t
 
s
p
e
c
i
f
i
c
.
P
a
c
k
a
g
e
 
C
o
h
e
s
i
o
n
R
e
l
e
a
s
e
 
R
e
u
s
e
 
E
q
u
i
v
a
l
e
n
c
y
 
P
r
i
n
c
i
p
l
e
 
(
R
R
E
P
)
T
h
e
 
g
r
a
n
u
l
e
 
o
f
 
r
e
u
s
e
 
i
s
 
t
h
e
 
g
r
a
n
u
l
e
 
o
f
 
r
e
l
e
a
s
e
.
C
o
m
m
o
n
 
C
l
o
s
u
r
e
 
P
r
i
n
c
i
p
l
e
 
(
C
C
P
)
C
l
a
s
s
e
s
 
t
h
a
t
 
c
h
a
n
g
e
 
t
o
g
e
t
h
e
r
 
a
r
e
 
p
a
c
k
a
g
e
d
 
t
o
g
e
t
h
e
r
.
C
o
m
m
o
n
 
R
e
u
s
e
 
P
r
i
n
c
i
p
l
e
 
(
C
R
P
)
C
l
a
s
s
e
s
 
t
h
a
t
 
a
r
e
 
u
s
e
d
 
t
o
g
e
t
h
e
r
 
a
r
e
 
p
a
c
k
a
g
e
d
 
t
o
g
e
t
h
e
r
.
P
a
c
k
a
g
e
 
C
o
u
p
l
i
n
g
A
c
y
c
l
i
c
 
D
e
p
e
n
d
e
n
c
i
e
s
 
P
r
i
n
c
i
p
l
e
 
(
A
D
P
)
T
h
e
 
d
e
p
e
n
d
e
n
c
y
 
g
r
a
p
h
 
o
f
 
p
a
c
k
a
g
e
s
 
m
u
s
t
 
h
a
v
e
 
n
o
 
c
y
c
l
e
s
S
t
a
b
l
e
 
D
e
p
e
n
d
e
n
c
i
e
s
 
P
r
i
n
c
i
p
l
e
 
(
S
D
P
)
D
e
p
e
n
d
 
i
n
 
t
h
e
 
d
i
r
e
c
t
i
o
n
 
o
f
 
s
t
a
b
i
l
i
t
y
.
S
t
a
b
l
e
 
A
b
s
t
r
a
c
t
i
o
n
s
 
P
r
i
n
c
i
p
l
e
 
(
S
A
P
)
A
b
s
t
r
a
c
t
n
e
s
s
 
i
n
c
r
e
a
s
e
s
 
w
i
t
h
 
s
t
a
b
i
l
i
t
y
.
G
e
n
e
r
a
l
M
u
l
t
i
p
l
e
 
L
a
n
g
u
a
g
e
s
 
I
n
 
O
n
e
 
S
o
u
r
c
e
 
F
i
l
e
X
M
L
,
 
H
T
M
L
,
 
X
A
M
L
,
 
E
n
g
l
i
s
h
,
 
G
e
r
m
a
n
,
 
J
a
v
a
S
c
r
i
p
t
,
 
Y
F
o
l
l
o
w
 
S
t
a
n
d
a
r
d
 
C
o
n
v
e
n
t
i
o
n
s
C
o
d
i
n
g
-
,
 
A
r
c
h
i
t
e
c
t
u
r
e
-
,
 
D
e
s
i
g
n
-
G
u
i
d
e
l
i
n
e
s
 
(
c
h
e
c
k
 
t
h
e
m
 
w
i
t
h
 
t
o
o
l
s
)
K
e
e
p
 
i
t
 
s
i
m
p
l
e
,
 
s
t
u
p
i
d
 
(
K
I
S
S
)
S
i
m
p
l
e
r
 
i
s
 
a
l
w
a
y
s
 
b
e
t
t
e
r
.
 
R
e
d
u
c
e
 
c
o
m
p
l
e
x
i
t
y
 
a
s
 
m
u
c
h
 
a
s
 
p
o
s
s
i
b
l
e
.
B
o
y
 
S
c
o
u
t
 
R
u
l
e
L
e
a
v
e
 
t
h
e
 
c
a
m
p
g
r
o
u
n
d
 
c
l
e
a
n
e
r
 
t
h
a
n
 
y
o
u
 
f
o
u
n
d
 
i
t
.
R
o
o
t
 
C
a
u
s
e
 
A
n
a
l
y
s
i
s
A
l
w
a
y
s
 
l
o
o
k
 
f
o
r
 
t
h
e
 
r
o
o
t
 
c
a
u
s
e
 
o
f
 
a
 
p
r
o
b
l
e
m
.
 
O
t
h
e
r
w
i
s
e
,
 
i
t
 
w
i
l
l
 
g
e
t
 
y
o
u
 
a
g
a
i
n
 
a
n
d
 
a
g
a
i
n
.
M
a
i
n
t
a
i
n
a
b
i
l
i
t
y
 
K
i
l
l
e
r
s
D
u
p
l
i
c
a
t
i
o
n
E
l
i
m
i
n
a
t
e
 
d
u
p
l
i
c
a
t
i
o
n
.
 
]
}
o

ı
]
}
v
}
(
ı
Z
˚
c
}
v
[
ı
„
˚
›
˚

ı
Ç
}
µ
„
’
˚
o
(
^
(
D
R
Y
)
 
p
r
i
n
c
i
p
l
e
.
M
a
g
i
c
 
N
u
m
b
e
r
s
 
/
 
S
t
r
i
n
g
s
R
e
p
l
a
c
e
 
M
a
g
i
c
 
N
u
m
b
e
r
s
 
w
i
t
h
 
n
a
m
e
d
 
c
o
n
s
t
a
n
t
s
.
E
n
u
m
s
 
(
p
e
r
s
i
s
t
e
n
t
 
o
r
 
d
e
f
i
n
i
n
g
 
b
e
h
a
v
i
o
u
r
)
U
s
e
 
r
e
f
e
r
e
n
c
e
 
c
o
d
e
s
 
i
n
s
t
e
a
d
 
o
f
 
e
n
u
m
s
 
i
f
 
t
h
e
y
 
h
a
v
e
 
t
o
 
b
e
 
p
e
r
s
i
s
t
e
d
.
U
s
e
 
p
o
l
y
m
o
r
p
h
i
s
m
 
i
n
s
t
e
a
d
 
o
f
 
e
n
u
m
s
 
i
f
 
t
h
e
y
 
d
e
f
i
n
e
 
b
e
h
a
v
i
o
u
r
.
A
u
t
h
o
r
:
 
U
r
s
 
E
n
z
l
e
r
N
a
m
e
 
M
e
t
h
o
d
s
 
A
f
t
e
r
 
W
h
a
t
 
T
h
e
y
 
D
o
T
h
e
 
n
a
m
e
 
o
f
 
a
 
m
e
t
h
o
d
 
s
h
o
u
l
d
 
d
e
s
c
r
i
b
e
 
w
h
a
t
 
i
s
 
d
o
n
e
,
 
n
o
t
 
h
o
w
 
i
t
 
i
s
 
d
o
n
e
.
C
o
n
d
i
t
i
o
n
a
l
s
E
n
c
a
p
s
u
l
a
t
e
 
C
o
n
d
i
t
i
o
n
a
l
s
i
f
 
(
t
h
i
s
.
S
h
o
u
l
d
B
e
D
e
l
e
t
e
d
(
t
i
m
e
r
)
)
 
i
s
 
p
r
e
f
e
r
a
b
l
e
 
t
o
 
i
f
 
(
t
i
m
e
r
.
H
a
s
E
x
p
i
r
e
d
 
&
&
 
!
t
i
m
e
r
.
I
s
R
e
c
u
r
r
e
n
t
)
A
v
o
i
d
 
N
e
g
a
t
i
v
e
 
C
o
n
d
i
t
i
o
n
a
l
s
N
e
g
a
t
i
v
e
 
c
o
n
d
i
t
i
o
n
a
l
s
 
a
r
e
 
h
a
r
d
e
r
 
t
o
 
r
e
a
d
 
t
h
a
n
 
p
o
s
i
t
i
v
e
 
c
o
n
d
i
t
i
o
n
a
l
s
.
E
n
c
a
p
s
u
l
a
t
e
 
B
o
u
n
d
a
r
y
 
C
o
n
d
i
t
i
o
n
s
B
o
u
n
d
a
r
y
 
c
o
n
d
i
t
i
o
n
s
 
a
r
e
 
h
a
r
d
 
t
o
 
k
e
e
p
 
t
r
a
c
k
 
o
f
.
 
P
u
t
 
t
h
e
 
p
r
o
c
e
s
s
i
n
g
 
f
o
r
 
t
h
e
m
 
i
n
 
o
n
e
 
p
l
a
c
e
.
E
.
g
.
 
n
e
x
t
L
e
v
e
l
 
=
 
l
e
v
e
l
 
+
 
1
;
N
e
s
t
i
n
g
N
e
s
t
e
d
 
c
o
d
e
 
s
h
o
u
l
d
 
b
e
 
m
o
r
e
 
s
p
e
c
i
f
i
c
 
o
r
 
h
a
n
d
l
e
 
l
e
s
s
 
p
r
o
b
a
b
l
e
 
s
c
e
n
a
r
i
o
s
 
t
h
a
n
 
u
n
n
e
s
t
e
d
 
c
o
d
e
.
S
e
p
a
r
a
t
e
 
M
u
l
t
i
-
T
h
r
e
a
d
i
n
g
 
C
o
d
e
D
o
 
n
o
t
 
m
i
x
 
c
o
d
e
 
t
h
a
t
 
h
a
n
d
l
e
s
 
m
u
l
t
i
-
t
h
r
e
a
d
i
n
g
 
a
s
p
e
c
t
s
 
w
i
t
h
 
t
h
e
 
r
e
s
t
 
o
f
 
t
h
e
 
c
o
d
e
.
 
S
e
p
a
r
a
t
e
 
t
h
e
m
 
i
n
t
o
 
d
i
f
f
e
r
e
n
t
 
c
l
a
s
s
e
s
.
```