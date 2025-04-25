# Clean TDD Cheat Sheet

```
S
t
r
u
c
t
u
r
e
<
 
1
0
 
m
i
n
u
t
e
s
C
l
e
a
n
 
T
e
s
t
 
D
r
i
v
e
n
 
D
e
v
e
l
o
p
m
e
n
t
 
V
 
1
.
2
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
U
n
i
t
 
T
e
s
t
 
P
r
i
n
c
i
p
l
e
s
F
a
s
t
U
n
i
t
 
t
e
s
t
s
 
h
a
v
e
 
t
o
 
b
e
 
f
a
s
t
 
i
n
 
o
r
d
e
r
 
t
o
 
b
e
 
e
x
e
c
u
t
e
d
 
o
f
t
e
n
.
 
F
a
s
t
 
m
e
a
n
s
 
m
u
c
h
 
s
m
a
l
l
e
r
 
t
h
a
n
 
s
e
c
o
n
d
s
.
I
s
o
l
a
t
e
d
C
l
e
a
r
 
w
h
e
r
e
 
t
h
e
 
f
a
i
l
u
r
e
 
h
a
p
p
e
n
e
d
.
 
N
o
 
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
 
b
e
t
w
e
e
n
 
t
e
s
t
s
 
(
r
a
n
d
o
m
 
o
r
d
e
r
)
R
e
p
e
a
t
a
b
l
e
N
o
 
a
s
s
u
m
e
d
 
i
n
i
t
i
a
l
 
s
t
a
t
e
,
 
n
o
t
h
i
n
g
 
l
e
f
t
 
b
e
h
i
n
d
.
 
N
o
 
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
 
o
n
 
e
x
t
e
r
n
a
l
 
s
e
r
v
i
c
e
s
 
t
h
a
t
 
m
i
g
h
t
 
b
e
 
u
n
a
v
a
i
l
a
b
l
e
 
(
d
a
t
a
b
a
s
e
s
,
 
f
i
l
e
 
s
y
s
t
e
m
,
 
Y
)
S
e
l
f
 
V
a
l
i
d
a
t
i
n
g
N
o
 
m
a
n
u
a
l
 
t
e
s
t
 
i
n
t
e
r
p
r
e
t
a
t
i
o
n
 
o
r
 
i
n
t
e
r
v
e
n
t
i
o
n
.
 
R
e
d
 
o
r
 
g
r
e
e
n
!
T
i
m
e
l
y
T
e
s
t
s
 
a
r
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
 
r
i
g
h
t
 
t
i
m
e
 
(
T
D
D
,
 
D
D
T
,
 
P
O
U
T
i
n
g
)
K
i
n
d
s
 
o
f
 
U
n
i
t
 
T
e
s
t
s
T
D
D
 
t
 
T
e
s
t
 
D
r
i
v
e
n
 
D
e
v
e
l
o
p
m
e
n
t
r
e
d
 
t
 
g
r
e
e
n
 
t
 
r
e
f
a
c
t
o
r
.
 
T
e
s
t
 
a
 
l
i
t
t
l
e
 
t
 
c
o
d
e
 
a
 
l
i
t
t
l
e
.
D
D
T
 
t
 
D
e
f
e
c
t
 
D
r
i
v
e
n
 
T
e
s
t
i
n
g
W
r
i
t
e
 
a
 
u
n
i
t
 
t
e
s
t
 
t
h
a
t
 
r
e
p
r
o
d
u
c
e
s
 
t
h
e
 
d
e
f
e
c
t
 
t
 
F
i
x
 
c
o
d
e
 
t
 
T
e
s
t
 
w
i
l
l
 
s
u
c
c
e
e
d
 
t
 
D
e
f
e
c
t
 
w
i
l
l
 
n
e
v
e
r
 
r
e
t
u
r
n
.
P
O
U
T
i
n
g
 
t
 
P
l
a
i
n
 
O
l
d
 
U
n
i
t
 
T
e
s
t
i
n
g
a
k
a
 
t
e
s
t
 
a
f
t
e
r
.
 
W
r
i
t
e
 
u
n
i
t
 
t
e
s
t
s
 
t
o
 
c
h
e
c
k
 
e
x
i
s
t
i
n
g
 
c
o
d
e
.
 
Y
o
u
 
c
a
n
n
o
t
 
a
n
d
 
p
r
o
b
a
b
l
y
 
d
o
 
n
o
t
 
w
a
n
t
 
t
o
 
t
e
s
t
 
d
r
i
v
e
 
e
v
e
r
y
t
h
i
n
g
.
 
U
s
e
 
P
O
U
T
 
t
o
 
i
n
c
r
e
a
s
e
 
s
a
n
i
t
y
.
 
U
s
e
 
t
o
 
a
d
d
 
a
d
d
i
t
i
o
n
a
l
 
t
e
s
t
s
 
a
f
t
e
r
 
T
D
D
i
n
g
 
(
e
.
g
.
 
b
o
u
n
d
a
r
y
 
c
a
s
e
s
)
.
M
o
c
k
i
n
g
 
(
S
t
u
b
s
,
 
F
a
k
e
s
,
 
S
p
i
e
s
,
 
M
o
c
k
s
,
 
)
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
C
o
m
m
i
t
 
C
h
e
c
k
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
 
c
o
v
e
r
i
n
g
 
c
u
r
r
e
n
t
l
y
 
w
o
r
k
e
d
 
o
n
 
c
o
d
e
 
p
r
i
o
r
 
t
o
 
c
o
m
m
i
t
t
i
n
g
 
t
o
 
t
h
e
 
s
o
u
r
c
e
 
c
o
d
e
 
r
e
p
o
s
i
t
o
r
y
.
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
 
C
h
e
c
k
R
u
n
 
a
l
l
 
a
u
t
o
m
a
t
e
d
 
i
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
 
a
n
d
 
u
n
i
t
 
t
e
s
t
s
 
o
n
 
e
v
e
r
y
 
c
o
m
m
i
t
 
t
o
 
t
h
e
 
s
o
u
r
c
e
 
c
o
d
e
 
r
e
p
o
s
i
t
o
r
y
.
A
u
t
o
m
a
t
e
d
 
A
c
c
e
p
t
a
n
c
e
 
T
e
s
t
s
R
u
n
 
a
l
l
 
a
u
t
o
m
a
t
e
d
 
a
c
c
e
p
t
a
n
c
e
 
t
e
s
t
s
 
a
s
 
o
f
t
e
n
 
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
 
o
n
 
t
h
e
 
i
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
 
s
e
r
v
e
r
.
C
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
 
F
a
i
l
e
d
 
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
 
t
o
 
W
h
o
l
e
 
T
e
a
m
W
h
e
n
e
v
e
r
 
a
 
s
t
a
g
e
 
o
n
 
t
h
e
 
c
o
n
t
i
n
u
o
u
s
 
i
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
 
s
e
r
v
e
r
 
f
a
i
l
s
 
t
h
e
n
 
n
o
t
i
f
y
 
w
h
o
l
e
 
t
e
a
m
 
i
n
 
o
r
d
e
r
 
t
o
 
g
e
t
 
b
l
o
c
k
i
n
g
 
s
i
t
u
a
t
i
o
n
 
r
e
s
o
l
v
e
d
 
a
s
 
s
o
o
n
 
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
D
e
s
i
g
n
 
f
o
r
 
T
e
s
t
a
b
i
l
i
t
y
C
o
n
s
t
r
u
c
t
o
r
 
t
 
S
i
m
p
l
i
c
i
t
y
O
b
j
e
c
t
s
 
h
a
v
e
 
t
o
 
b
e
 
e
a
s
i
l
y
 
c
r
e
a
t
a
b
l
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
 
e
a
s
y
 
a
n
d
 
f
a
s
t
 
t
e
s
t
i
n
g
 
i
s
 
n
o
t
 
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
o
n
s
t
r
u
c
t
o
r
 
t
 
L
i
f
e
t
i
m
e
P
a
s
s
 
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
 
a
n
d
 
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
/
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
 
i
n
t
o
 
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
o
r
 
t
h
a
t
 
h
a
v
e
 
a
 
l
i
f
e
t
i
m
e
 
e
q
u
a
l
 
o
r
 
l
o
n
g
e
r
 
t
h
a
n
 
t
h
e
 
c
r
e
a
t
e
d
 
o
b
j
e
c
t
.
 
F
o
r
 
o
t
h
e
r
 
v
a
l
u
e
s
 
u
s
e
 
m
e
t
h
o
d
s
 
o
r
 
p
r
o
p
e
r
t
i
e
s
.
T
D
D
 
P
r
i
n
c
i
p
l
e
s
T
D
D
 
P
r
o
c
e
s
s
 
S
m
e
l
l
s
U
s
i
n
g
 
C
o
d
e
 
C
o
v
e
r
a
g
e
 
a
s
 
a
 
G
o
a
l
’
˚

}
ˆ
˚

}
À
˚
„

P
˚
ı
}
(
]
v
ˆ
u
]
’
’
]
v
P
ı
˚
’
ı
’

µ
ı
ˆ
}
v
[
ı
µ
’
˚
]
ı

’

ˆ
„
]
À
]
v
P
ı
}
}
o
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
 
r
e
s
u
l
t
 
c
o
u
l
d
 
b
e
 
t
e
s
t
s
 
t
h
a
t
 
i
n
c
r
e
a
s
e
 
c
o
d
e
 
c
o
v
e
r
a
g
e
 
b
u
t
 
n
o
t
 
c
e
r
t
a
i
n
i
t
y
.
N
o
 
G
r
e
e
n
 
B
a
r
 
i
n
 
t
h
e
 
l
a
s
t
 
~
1
0
 
M
i
n
u
t
e
s
M
a
k
e
 
s
m
a
l
l
 
s
t
e
p
s
 
t
o
 
g
e
t
 
f
e
e
d
b
a
c
k
 
a
s
 
f
a
s
t
 
a
n
d
 
f
r
e
q
u
e
n
t
 
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
N
o
t
 
r
u
n
n
i
n
g
 
t
e
s
t
 
b
e
f
o
r
e
 
w
r
i
t
i
n
g
 
p
r
o
d
u
c
t
i
o
n
 
c
o
d
e
O
n
l
y
 
i
f
 
t
h
e
 
t
e
s
t
 
f
a
i
l
s
 
t
h
e
n
 
n
e
w
 
c
o
d
e
 
i
s
 
r
e
q
u
i
r
e
d
.
 
A
d
d
i
t
i
o
n
a
l
l
y
,
 
i
f
 
t
h
e
 
t
e
s
t
 
d
o
e
s
 
s
u
r
p
r
i
s
i
n
g
l
y
 
n
o
t
 
f
a
i
l
 
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
e
 
t
e
s
t
 
i
s
 
c
o
r
r
e
c
t
.
N
o
t
 
s
p
e
n
d
i
n
g
 
e
n
o
u
g
h
 
t
i
m
e
 
o
n
 
r
e
f
a
c
t
o
r
i
n
g
R
e
f
a
c
t
o
r
i
n
g
 
i
s
 
a
n
 
i
n
v
e
s
t
m
e
n
t
 
i
n
t
o
 
t
h
e
 
f
u
t
u
r
e
.
 
R
e
a
d
a
b
l
i
t
y
,
 
c
h
a
n
g
e
a
b
i
l
i
t
y
 
a
n
d
 
e
x
t
e
n
s
i
b
i
l
i
t
y
 
w
i
l
l
 
p
a
y
 
b
a
c
k
.
S
k
i
p
p
i
n
g
 
s
o
m
e
t
h
i
n
g
 
t
o
o
 
e
a
s
y
 
t
o
 
t
e
s
t
}
v
[
ı

’
’
µ
u
˚
,
 
c
h
e
c
k
 
i
t
.
 
I
f
 
i
t
 
i
s
 
e
a
s
y
 
t
h
e
n
 
t
h
e
 
t
e
s
t
 
i
s
 
e
v
e
n
 
e
a
s
i
e
r
.
S
k
i
p
p
i
n
g
 
s
o
m
e
t
h
i
n
g
 
t
o
o
 
h
a
r
d
 
t
o
 
t
e
s
t
M
a
k
e
 
i
t
 
s
i
m
p
l
e
r
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
 
b
u
g
s
 
w
i
l
l
 
h
i
d
e
 
i
n
 
t
h
e
r
e
 
a
n
d
 
m
a
i
n
t
a
i
n
a
b
l
i
t
y
 
w
i
l
l
 
s
u
f
f
e
r
.
O
r
g
a
n
i
z
i
n
g
 
t
e
s
t
s
 
a
r
o
u
n
d
 
m
e
t
h
o
d
s
,
 
n
o
t
 
b
e
h
a
v
i
o
r
.
T
h
e
s
e
 
t
e
s
t
s
 
a
r
e
 
b
r
i
t
t
l
e
 
a
n
d
 
r
e
f
a
c
t
o
r
i
n
g
 
k
i
l
l
e
r
s
.
 
˚
’
ı

}
u
›
o
˚
ı
˚
c
u
]
v
]
^
µ
’
˚
c
a
s
e
s
 
i
n
 
a
 
w
a
y
 
t
h
e
 
f
e
a
t
u
r
e
 
w
i
l
l
 
b
e
 
u
s
e
d
 
i
n
 
t
h
e
 
r
e
a
l
 
w
o
r
l
d
.
 
U
n
i
t
 
T
e
s
t
 
S
m
e
l
l
s
T
e
s
t
 
n
o
t
 
t
e
s
t
i
n
g
 
a
n
y
t
h
i
n
g
P
a
s
s
i
n
g
 
t
e
s
t
 
t
h
a
t
 
a
t
 
f
i
r
s
t
 
s
i
g
h
t
 
a
p
p
e
a
r
s
 
v
a
l
i
d
,
 
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
 
t
e
s
t
 
t
h
e
 
t
e
s
t
e
e
.
T
e
s
t
 
n
e
e
d
i
n
g
 
e
x
c
e
s
s
i
v
e
 
s
e
t
u
p
A
 
t
e
s
t
 
t
h
a
t
 
n
e
e
d
s
 
d
o
z
e
n
s
 
o
f
 
l
i
n
e
s
 
o
f
 
c
o
d
e
 
t
o
 
s
e
t
u
p
 
i
t
s
 
e
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
.
 
T
h
i
s
 
n
o
i
s
e
 
m
a
k
e
s
 
i
t
 
d
i
f
f
i
c
u
l
t
 
t
o
 
s
e
e
 
w
h
a
t
 
i
s
 
r
e
a
l
l
y
 
t
e
s
t
e
d
.
T
o
o
 
l
a
r
g
e
 
t
e
s
t
A
 
v
a
l
i
d
 
t
e
s
t
 
t
h
a
t
 
i
s
 
h
o
w
e
v
e
r
 
t
o
o
 
l
a
r
g
e
.
 
R
e
a
s
o
n
s
 
c
a
n
 
b
e
 
t
h
a
t
 
t
h
i
s
 
t
e
s
t
 
c
h
e
c
k
s
 
f
o
r
 
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
 
f
e
a
t
u
r
e
 
o
r
 
t
h
e
 
t
e
s
t
e
e
 
d
o
e
s
 
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
 
t
h
i
n
g
 
(
v
i
o
l
a
t
i
o
n
 
o
f
 
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
)
.
C
h
e
c
k
i
n
g
 
i
n
t
e
r
n
a
l
s
A
 
t
e
s
t
 
t
h
a
t
 
a
c
c
e
s
s
e
s
 
i
n
t
e
r
n
a
l
s
 
o
f
 
t
h
e
 
t
e
s
t
e
e
 
(
p
r
i
v
a
t
e
/
p
r
o
t
e
c
t
e
d
 
m
e
m
b
e
r
s
)
.
 
T
h
i
s
 
i
s
 
a
 
r
e
f
a
c
t
o
r
i
n
g
 
k
i
l
l
e
r
.
˚
’
ı
}
v
o
Ç
„
µ
v
v
]
v
P
}
v
ı
Z
˚
ˆ
˚
À
˚
o
}
›
˚
„
[
’
u


Z
]
v
˚
A
 
t
e
s
t
 
t
h
a
t
 
i
s
 
d
e
p
e
n
d
e
n
t
 
o
n
 
t
h
e
 
d
e
v
e
l
o
p
m
e
n
t
 
e
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
 
a
n
d
 
f
a
i
l
s
 
e
l
s
e
w
h
e
r
e
.
 
U
s
e
 
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
 
t
o
 
c
a
t
c
h
 
t
h
e
m
 
a
s
 
s
o
o
n
 
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
T
e
s
t
 
c
h
e
c
k
i
n
g
 
m
o
r
e
 
t
h
a
n
 
n
e
c
e
s
s
a
r
y
A
 
t
e
s
t
 
t
h
a
t
 
c
h
e
c
k
s
 
m
o
r
e
 
t
h
a
n
 
i
t
 
i
s
 
d
e
d
i
c
a
t
e
d
 
t
o
.
 
T
h
e
s
e
 
t
e
s
t
s
 
f
a
i
l
s
 
w
h
e
n
e
v
e
r
 
s
o
m
e
t
h
i
n
g
 
c
h
a
n
g
e
s
 
t
h
a
t
 
i
t
 
u
n
n
e
c
e
s
s
a
r
i
l
y
 
c
h
e
c
k
s
.
 
E
s
p
e
c
i
a
l
l
y
 
p
r
o
b
a
b
l
e
 
w
h
e
n
 
m
o
c
k
s
 
a
r
e
 
i
n
v
o
l
v
e
d
 
o
r
 
c
h
e
c
k
i
n
g
 
f
o
r
 
i
t
e
m
 
o
r
d
e
r
 
i
n
 
u
n
o
r
d
e
r
e
d
 
c
o
l
l
e
c
t
i
o
n
s
.
 
M
i
s
s
i
n
g
 
a
s
s
e
r
t
i
o
n
s
T
e
s
t
s
 
t
h
a
t
 
d
o
 
n
o
t
 
h
a
v
e
 
a
n
y
 
a
s
s
e
r
t
i
o
n
s
.
 
C
h
a
t
t
y
 
t
e
s
t
A
 
t
e
s
t
 
t
h
a
t
 
f
i
l
l
s
 
t
h
e
 
c
o
n
s
o
l
e
 
w
i
t
h
 
t
e
x
t
 
t
 
p
r
o
p
a
b
l
y
 
u
s
e
d
 
o
n
c
e
 
t
o
 
c
h
e
c
k
 
f
o
r
 
s
o
m
e
t
h
i
n
g
 
m
a
n
u
a
l
l
y
.
T
e
s
t
 
s
w
a
l
l
o
w
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
A
 
t
e
s
t
 
t
h
a
t
 
c
a
t
c
h
e
s
 
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
n
d
 
l
e
t
 
t
h
e
 
t
e
s
t
 
p
a
s
s
.
T
e
s
t
 
n
o
t
 
b
e
l
o
n
g
i
n
g
 
i
n
 
h
o
s
t
 
t
e
s
t
 
f
i
x
t
u
r
e
A
 
t
e
s
t
 
t
h
a
t
 
t
e
s
t
s
 
a
 
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
 
d
i
f
f
e
r
e
n
t
 
t
e
s
t
e
e
 
t
h
a
n
 
a
l
l
 
o
t
h
e
r
 
t
e
s
t
s
 
i
n
 
t
h
e
 
f
i
x
t
u
r
e
.
O
b
s
o
l
e
t
e
 
t
e
s
t
A
 
t
e
s
t
 
t
h
a
t
 
c
h
e
c
k
s
 
s
o
m
e
t
h
i
n
g
 
n
o
 
l
o
n
g
e
r
 
r
e
q
u
i
r
e
d
 
i
n
 
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
 
M
a
y
 
e
v
e
n
 
p
r
e
v
e
n
t
 
c
l
e
a
n
 
u
p
 
o
f
 
p
r
o
d
u
c
t
i
o
n
 
c
o
d
e
 
b
e
c
a
u
s
e
 
i
t
 
i
s
 
s
t
i
l
l
 
r
e
f
e
r
e
n
c
e
d
.
T
D
D
 
C
y
c
l
e
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
 
D
o
m
a
i
n
I
n
i
t
i
a
l
 
D
e
s
i
g
n
W
r
i
t
e
 
a
 
T
e
s
t
W
r
i
t
e
 
C
o
d
e
R
u
n
 
a
l
l
 
T
e
s
t
s
C
l
e
a
n
 
u
p
 
C
o
d
e
s
u
c
c
e
e
d
s
f
a
i
l
s
f
a
i
l
s
u
c
c
e
e
d
,
c
o
d
e
 
n
o
t
c
l
e
a
n
s
u
c
c
e
e
d
,
 
c
o
d
e
 
c
l
e
a
n
,
T
O
D
O
 
l
i
s
t
 
n
o
t
 
e
m
p
t
y
<
 
1
0
 
m
i
n
u
t
e
s
<
 
1
0
 
m
i
n
u
t
e
s
a
s
 
l
o
n
g
 
a
s
 
i
s
 
n
e
e
d
e
d
 
t
o
 
g
e
t
 
s
t
a
r
t
e
d
a
s
 
l
o
n
g
 
a
s
 
i
s
 
n
e
e
d
e
d
 
f
o
r
 
f
i
r
s
t
 
t
e
s
t
,
 
b
u
t
 
n
o
t
 
l
o
n
g
e
r
A
 
t
e
s
t
 
c
h
e
c
k
s
 
o
n
e
 
f
e
a
t
u
r
e
A
 
t
e
s
t
 
c
h
e
c
k
s
 
e
x
a
c
t
l
y
 
o
n
e
 
f
e
a
t
u
r
e
 
o
f
 
t
h
e
 
t
e
s
t
e
e
.
 
T
h
a
t
 
m
e
a
n
s
 
t
h
a
t
 
i
t
 
t
e
s
t
s
 
a
l
l
 
t
h
i
n
g
s
 
i
n
c
l
u
d
e
d
 
i
n
 
t
h
i
s
 
f
e
a
t
u
r
e
 
b
u
t
 
n
o
t
 
m
o
r
e
.
 
T
h
i
s
 
i
n
c
l
u
d
e
s
 
p
r
o
p
a
b
l
y
 
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
 
c
a
l
l
 
t
o
 
t
h
e
 
t
e
s
t
e
e
.
 
T
h
i
s
 
w
a
y
,
 
t
h
e
 
t
e
s
t
s
 
s
e
r
v
e
 
a
s
 
s
a
m
p
l
e
s
 
a
n
d
 
d
o
c
u
m
e
n
t
a
t
i
o
n
 
o
f
 
t
h
e
 
u
s
a
g
e
 
o
f
 
t
h
e
 
t
e
s
t
e
e
.
A
r
r
a
n
g
e
 
t
 
A
c
t
 
t
 
A
s
s
e
r
t
S
t
r
u
c
t
u
r
e
 
t
h
e
 
t
e
s
t
s
 
a
l
w
a
y
s
 
b
y
 
A
A
A
.
T
e
s
t
 
A
s
s
e
m
b
l
i
e
s
C
r
e
a
t
e
 
a
 
t
e
s
t
 
a
s
s
e
m
b
l
y
 
f
o
r
 
e
a
c
h
 
p
r
o
d
u
c
t
i
o
n
 
a
s
s
e
m
b
l
y
 
a
n
d
 
n
a
m
e
 
i
t
 
a
s
 
t
h
e
 
p
r
o
d
u
c
t
i
o
n
 
a
s
s
e
m
b
l
y
 
+
 
c
.
˚
’
ı
^
.
T
e
s
t
 
N
a
m
e
s
p
a
c
e
P
u
t
 
t
h
e
 
t
e
s
t
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
 
n
a
m
e
s
p
a
c
e
 
a
s
 
t
h
e
i
r
 
a
s
s
o
c
i
a
t
e
d
 
t
e
s
t
e
e
.
I
s
o
l
a
t
i
o
n
 
f
r
o
m
 
e
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
U
s
e
 
m
o
c
k
s
 
t
o
 
s
i
m
u
l
a
t
e
 
a
l
l
 
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
 
o
f
 
t
h
e
 
t
e
s
t
e
e
.
M
o
c
k
i
n
g
 
f
r
a
m
e
w
o
r
k
U
s
e
 
a
 
d
y
n
a
m
i
c
 
m
o
c
k
 
f
r
a
m
e
w
o
r
k
 
f
o
r
 
m
o
c
k
s
 
t
h
a
t
 
s
h
o
w
 
d
i
f
f
e
r
e
n
t
 
b
e
h
a
v
i
o
u
r
 
i
n
 
d
i
f
f
e
r
e
n
t
 
t
e
s
t
 
s
c
e
n
a
r
i
o
s
 
(
l
i
t
t
l
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
 
r
e
u
s
e
)
.
M
a
n
u
a
l
l
y
 
w
r
i
t
t
e
n
 
m
o
c
k
s
U
s
e
 
m
a
n
u
a
l
l
y
 
w
r
i
t
t
e
n
 
m
o
c
k
s
 
w
h
e
n
 
t
h
e
y
 
c
a
n
 
b
e
 
u
s
e
d
 
i
n
 
s
e
v
e
r
a
l
 
t
e
s
t
s
 
a
n
d
 
t
h
e
y
 
h
a
v
e
 
o
n
l
y
 
l
i
t
t
l
e
 
c
h
a
n
g
e
d
 
b
e
h
a
v
i
o
u
r
 
i
n
 
t
h
e
s
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
 
(
b
e
h
a
v
i
o
u
r
 
r
e
u
s
e
)
.
T
i
n
y
 
s
t
e
p
s
M
a
k
e
 
t
i
n
y
 
l
i
t
t
l
e
 
s
t
e
p
s
.
 
A
d
d
 
o
n
l
y
 
a
 
l
i
t
t
l
e
 
c
o
d
e
 
i
n
 
t
e
s
t
 
b
e
f
o
r
e
 
w
r
i
t
i
n
g
 
t
h
e
 
n
e
e
d
e
d
 
p
r
o
d
u
c
t
i
o
n
 
c
o
d
e
.
 
T
h
e
n
 
r
e
p
e
a
t
.
 
A
d
d
 
o
n
l
y
 
o
n
e
 
A
s
s
e
r
t
 
p
e
r
 
s
t
e
p
.
M
i
x
i
n
g
 
S
t
u
b
i
n
g
 
a
n
d
 
E
x
p
e
c
t
a
t
i
o
n
 
D
e
c
l
a
r
a
t
i
o
n
 
M
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
 
y
o
u
 
f
o
l
l
o
w
 
t
h
e
 
A
A
A
 
(
a
r
r
a
n
g
e
,
 
a
c
t
,
 
a
s
s
e
r
t
)
 
s
y
n
t
a
x
 
w
h
e
n
 
u
s
i
n
g
 
m
o
c
k
s
.
 
}
v
[
ı
u
]
Æ
’
˚
ı
ı
]
v
P
µ
›
’
ı
µ

’
(
s
o
 
t
h
a
t
 
t
h
e
 
t
e
s
t
e
e
 
c
a
n
 
r
u
n
)
 
w
i
t
h
 
e
x
p
e
c
t
a
t
i
o
n
s
 
(
o
n
 
w
h
a
t
 
t
h
e
 
t
e
s
t
e
e
 
s
h
o
u
l
d
 
d
o
)
 
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
o
d
e
 
b
l
o
c
k
.
C
h
e
c
k
i
n
g
 
m
o
c
k
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
 
t
e
s
t
e
e
T
e
s
t
s
 
t
h
a
t
 
c
h
e
c
k
 
n
o
t
 
t
h
e
 
t
e
s
t
e
e
 
b
u
t
 
v
a
l
u
e
s
 
r
e
t
u
r
n
e
d
 
b
y
 
m
o
c
k
s
.
 
N
o
r
m
a
l
l
y
,
 
d
u
e
 
t
o
 
e
x
c
e
s
s
i
v
e
 
m
o
c
k
 
u
s
a
g
e
.
K
e
e
p
 
t
e
s
t
s
 
s
i
m
p
l
e
W
h
e
n
e
v
e
r
 
a
 
t
e
s
t
s
 
g
e
t
s
 
c
o
m
p
l
i
c
a
t
e
d
,
 
c
h
e
c
k
 
w
h
e
t
h
e
r
 
y
o
u
 
c
a
n
 
s
p
l
i
t
 
t
h
e
 
t
e
s
t
e
e
 
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
 
c
l
a
s
s
e
s
 
(
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
)
S
e
t
U
p
 
/
 
T
e
a
r
D
o
w
n
 
f
o
r
 
i
n
f
r
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
 
o
n
l
y
U
s
e
 
t
h
e
 
S
e
t
U
p
 
m
e
t
h
o
d
 
o
n
l
y
 
f
o
r
 
i
n
f
r
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
 
t
h
a
t
 
y
o
u
r
 
u
n
i
t
 
t
e
s
t
 
n
e
e
d
s
.
 
D
o
 
n
o
t
 
u
s
e
 
i
t
 
f
o
r
 
a
n
y
t
h
i
n
g
 
t
h
a
t
 
i
s
 
u
n
d
e
r
 
t
e
s
t
.
U
n
i
t
 
T
e
s
t
 
M
e
t
h
o
d
s
 
s
h
o
w
 
w
h
o
l
e
 
t
r
u
t
h
U
n
i
t
 
t
e
s
t
 
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
w
 
a
l
l
 
p
a
r
t
s
 
n
e
e
d
e
d
 
f
o
r
 
t
h
e
 
t
e
s
t
.
 
D
o
 
n
o
t
 
u
s
e
 
S
e
t
U
p
 
m
e
t
h
o
d
 
o
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
 
t
o
 
p
e
r
f
o
r
m
 
a
c
t
i
o
n
s
 
o
n
 
t
e
s
t
e
e
 
o
r
 
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
H
i
d
d
e
n
 
t
e
s
t
 
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
T
e
s
t
 
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
 
h
i
d
d
e
n
 
i
n
 
e
i
t
h
e
r
 
t
h
e
 
S
e
t
U
p
 
m
e
t
h
o
d
,
 
b
a
s
e
 
c
l
a
s
s
 
o
r
 
h
e
l
p
e
r
 
c
l
a
s
s
.
 
T
h
e
 
t
e
s
t
 
s
h
o
u
l
d
 
b
e
 
c
l
e
a
r
 
b
y
 
l
o
o
k
i
n
g
 
a
t
 
t
h
e
 
t
e
s
t
 
m
e
t
h
o
d
 
o
n
l
y
 
t
 
n
o
 
i
n
i
t
i
a
l
i
z
a
t
i
o
n
 
o
r
 
a
s
s
e
r
t
s
 
s
o
m
e
w
h
e
r
e
 
e
l
s
e
.
A
c
c
e
p
t
a
n
c
e
 
T
e
s
t
 
D
r
i
v
e
n
 
D
e
v
e
l
o
p
m
e
n
t
U
s
e
 
A
c
c
e
p
t
a
n
c
e
 
T
e
s
t
s
 
t
o
 
d
r
i
v
e
 
y
o
u
r
 
T
D
D
 
t
e
s
t
s
A
c
c
e
p
t
a
n
c
e
 
t
e
s
t
s
 
c
h
e
c
k
 
f
o
r
 
t
h
e
 
n
e
e
d
e
d
 
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
 
L
e
t
 
t
h
e
m
 
g
u
i
d
e
 
y
o
u
r
 
T
D
D
.
U
s
e
r
 
F
e
a
t
u
r
e
 
T
e
s
t
A
n
 
A
c
c
e
p
t
a
n
c
e
 
t
e
s
t
 
i
s
 
a
 
t
e
s
t
 
f
o
r
 
a
 
c
o
m
p
l
e
t
e
 
u
s
e
r
 
f
e
a
t
u
r
e
 
f
r
o
m
 
t
o
p
 
t
o
 
b
o
t
t
o
m
 
t
h
a
t
 
p
r
o
v
i
d
e
s
 
b
u
s
i
n
e
s
s
 
v
a
l
u
e
.
A
u
t
o
m
a
t
e
d
 
A
T
D
D
U
s
e
 
a
u
t
o
m
a
t
e
d
 
A
c
c
e
p
t
a
n
c
e
 
T
e
s
t
 
D
r
i
v
e
n
 
D
e
v
e
l
o
p
m
e
n
t
 
f
o
r
 
r
e
g
r
e
s
s
i
o
n
 
t
e
s
t
i
n
g
 
a
n
d
 
e
x
e
c
u
t
a
b
l
e
 
s
p
e
c
i
f
i
c
a
t
i
o
n
s
.
E
x
c
e
s
s
i
v
e
 
m
o
c
k
 
u
s
a
g
e
I
f
 
y
o
u
r
 
t
e
s
t
 
n
e
e
d
s
 
a
 
l
o
t
 
o
f
 
m
o
c
k
s
 
o
r
 
m
o
c
k
 
s
e
t
u
p
 
t
h
e
n
 
c
o
n
s
i
d
e
r
 
s
p
l
i
t
t
i
n
g
 
t
h
e
 
t
e
s
t
e
e
 
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
 
c
l
a
s
s
e
s
 
o
r
 
p
r
o
v
i
d
e
 
a
n
 
a
d
d
i
t
i
o
n
a
l
 
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
 
b
e
t
w
e
e
n
 
y
o
u
r
 
t
e
s
t
e
e
 
a
n
d
 
i
t
s
 
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
C
l
e
a
n
 
C
o
d
e
F
o
l
l
o
w
 
t
h
e
 
g
u
i
d
e
l
i
n
e
s
 
f
r
o
m
 
C
l
e
a
n
 
C
o
d
e
 
t
o
 
g
e
t
 
a
 
d
e
s
i
g
n
 
t
h
a
t
 
i
s
 
e
a
s
y
 
t
e
s
t
a
b
l
e
.
 
I
f
 
i
t
 
i
s
 
n
o
t
 
e
a
s
y
 
t
e
s
t
a
b
l
e
 
t
h
e
n
 
t
h
e
 
d
e
s
i
g
n
 
h
a
s
 
t
o
 
b
e
 
i
m
p
r
o
v
e
d
.
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
 
L
a
y
e
r
s
 
a
t
 
S
y
s
t
e
m
 
B
o
u
n
d
a
r
y
U
s
e
 
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
 
l
a
y
e
r
s
 
a
t
 
s
y
s
t
e
m
 
b
o
u
n
d
a
r
i
e
s
 
(
d
a
t
a
b
a
s
e
,
 
f
i
l
e
 
s
y
s
t
e
m
,
 
w
e
b
 
s
e
r
v
i
c
e
s
,
 
C
O
M
 
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
 
.
.
.
)
 
t
h
a
t
 
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
i
n
g
 
b
y
 
e
n
a
b
l
i
n
g
 
t
h
e
 
u
s
a
g
e
 
o
f
 
m
o
c
k
s
.
M
i
x
i
n
g
 
A
c
t
 
a
n
d
 
A
s
s
e
r
t
A
s
s
e
r
t
 
s
t
a
t
e
m
e
n
s
 
t
h
a
t
 
e
x
e
c
u
t
e
 
c
o
d
e
 
o
n
 
t
h
e
 
t
e
s
t
e
e
.
 
F
i
r
s
t
,
 
e
x
e
c
u
t
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
 
o
n
 
t
e
s
t
e
e
 
a
n
d
 
s
t
o
r
e
 
r
e
s
u
l
t
 
i
n
 
a
 
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
.
 
A
f
t
e
r
w
a
r
d
s
,
 
m
a
k
e
 
a
s
s
e
r
t
i
o
n
s
.
 
E
s
p
e
c
i
a
l
l
y
,
 
i
f
 
s
e
v
e
r
a
l
 
a
s
s
e
r
t
i
o
n
s
 
i
n
 
a
 
s
i
n
g
l
e
 
t
e
s
t
.
A
u
t
o
m
a
t
i
c
a
l
l
y
 
b
u
i
l
d
 
a
n
 
I
n
s
t
a
l
l
e
r
 
f
o
r
 
T
e
s
t
 
S
y
s
t
e
m
A
u
t
o
m
a
t
i
c
a
l
l
y
 
b
u
i
l
d
 
a
n
 
i
n
s
t
a
l
l
e
r
 
a
s
 
o
f
t
e
n
 
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
 
t
o
 
t
e
s
t
 
s
o
f
t
w
a
r
e
 
o
n
 
a
 
t
e
s
t
 
s
y
s
t
e
m
 
(
f
o
r
 
m
a
n
u
a
l
 
t
e
s
t
s
,
 
o
r
 
t
e
s
t
s
 
w
i
t
h
 
r
e
a
l
 
h
a
r
d
w
a
r
e
)
.
T
O
D
O
 
L
i
s
t
s
u
c
c
e
e
d
,
c
o
d
e
 
c
l
e
a
n
,
e
m
p
t
y
 
T
O
D
O
 
l
i
s
t
A
d
d
 
m
i
s
s
i
n
g
 
t
e
s
t
 
w
h
e
n
 
y
o
u
 
t
h
i
n
k
 
o
f
 
o
n
e
.
R
e
m
o
v
e
 
t
e
s
t
 
w
h
e
n
 
w
r
i
t
t
e
n
.
W
e
 
w
r
i
t
e
 
o
u
r
 
T
O
D
O
 
l
i
s
t
 
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
o
d
e
 
f
i
l
e
 
a
s
 
t
h
e
 
u
n
i
t
 
t
e
s
t
s
 
a
s
 
/
/
 
T
O
D
O
:
S
t
a
r
t
 
o
v
e
r
 
o
n
 
n
e
x
t
 
f
e
a
t
u
r
e
p
i
c
k
 
t
e
s
t
 
w
i
t
h
 
g
r
e
a
t
e
s
t
 
i
m
p
a
c
t
 
o
n
 
d
e
s
i
g
n
R
u
n
 
T
e
s
t
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
G
r
e
e
n
 
B
a
r
 
P
a
t
t
e
r
n
s
F
a
k
e
 
I
t
 
(
Z
]
o
}
µ

l
˚
ı
)
R
e
t
u
r
n
 
a
 
c
o
n
s
t
a
n
t
 
t
o
 
g
e
t
 
f
i
r
s
t
 
t
e
s
t
 
r
u
n
n
i
n
g
.
 
R
e
f
a
c
t
o
r
 
l
a
t
e
r
.
T
r
i
a
n
g
u
l
a
t
e
 
t
 
D
r
i
v
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
W
r
i
t
e
 
t
e
s
t
 
w
i
t
h
 
a
t
 
l
e
a
s
t
 
t
w
o
 
s
e
t
s
 
o
f
 
s
a
m
p
l
e
 
d
a
t
a
.
 
A
b
s
t
r
a
c
t
 
i
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
 
o
n
 
t
h
e
s
e
.
O
b
v
i
o
u
s
 
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
I
f
 
t
h
e
 
i
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
 
i
s
 
o
b
v
i
o
u
s
 
t
h
e
n
 
j
u
s
t
 
i
m
p
l
e
m
e
n
t
 
i
t
 
a
n
d
 
s
e
e
 
i
f
 
t
e
s
t
 
r
u
n
s
.
 
I
f
 
n
o
t
 
t
h
e
n
 
s
t
e
p
 
b
a
c
k
 
a
n
d
 
j
u
s
t
 
g
e
t
 
t
e
s
t
 
r
u
n
n
i
n
g
 
a
n
d
 
r
e
f
a
c
t
o
r
 
t
h
e
n
.
O
n
e
 
t
o
 
M
a
n
y
 
t
 
D
r
i
v
e
 
C
o
l
l
e
c
t
i
o
n
 
O
p
e
r
a
t
i
o
n
s
F
i
r
s
t
,
 
i
m
p
l
e
m
e
n
t
 
o
p
e
r
a
t
i
o
n
 
f
o
r
 
a
 
s
i
n
g
l
e
 
e
l
e
m
e
n
t
.
 
T
h
e
n
,
 
s
t
e
p
 
t
o
 
s
e
v
e
r
a
l
 
e
l
e
m
e
n
t
s
.
R
e
f
a
c
t
o
r
i
n
g
 
P
a
t
t
e
r
n
s
R
e
c
o
n
c
i
l
e
 
D
i
f
f
e
r
e
n
c
e
s
 
t
 
U
n
i
f
y
 
S
i
m
i
l
a
r
 
C
o
d
e
S
t
e
p
w
i
s
e
 
c
h
a
n
g
e
 
b
o
t
h
 
p
i
e
c
e
s
 
o
f
 
c
o
d
e
 
u
n
t
i
l
 
t
h
e
y
 
a
r
e
 
i
d
e
n
t
i
c
a
l
.
I
s
o
l
a
t
e
 
C
h
a
n
g
e
F
i
r
s
t
,
 
i
s
o
l
a
t
e
 
t
h
e
 
c
o
d
e
 
t
o
 
b
e
 
r
e
f
a
c
t
o
r
e
d
 
f
r
o
m
 
t
h
e
 
r
e
s
t
.
 
T
h
e
n
 
r
e
f
a
c
t
o
r
.
 
F
i
n
a
l
l
y
,
 
u
n
d
o
 
i
s
o
l
a
t
i
o
n
.
M
i
g
r
a
t
e
 
D
a
t
a
M
o
v
i
n
g
 
f
r
o
m
 
o
n
e
 
r
e
p
r
e
s
e
n
t
a
t
i
o
n
 
t
o
 
a
n
o
t
h
e
r
 
b
y
 
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
R
e
d
 
B
a
r
 
P
a
t
t
e
r
n
s
O
n
e
 
S
t
e
p
 
T
e
s
t
P
i
c
k
 
a
 
t
e
s
t
 
y
o
u
 
a
r
e
 
c
o
n
f
i
d
e
n
t
 
y
o
u
 
c
a
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
 
a
n
d
 
m
a
x
i
m
i
z
e
s
 
l
e
a
r
n
i
n
g
 
e
f
f
e
c
t
 
(
e
.
g
.
 
i
m
p
a
c
t
 
o
n
 
d
e
s
i
g
n
)
.
L
e
a
r
n
i
n
g
 
T
e
s
t
W
r
i
t
e
 
t
e
s
t
s
 
a
g
a
i
n
s
t
 
e
x
t
e
r
n
a
l
 
c
o
m
p
o
n
e
n
t
s
 
t
o
 
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
e
y
 
b
e
h
a
v
e
 
a
s
 
e
x
p
e
c
t
e
d
.
A
n
o
t
h
e
r
 
T
e
s
t
(
Ç
}
µ
ı
Z
]
v
l
}
(
v
˚
Á
ı
˚
’
ı
’
ı
Z
˚
v
Á
„
]
ı
˚
ı
Z
˚
u
}
v
ı
Z
˚
o
]
’
ı

v
ˆ
ˆ
}
v
[
ı
o
}
}
’
˚
f
o
c
u
s
 
o
n
 
c
u
r
r
e
n
t
 
t
e
s
t
.
T
e
s
t
 
M
e
t
h
o
d
 
N
a
m
i
n
g
N
a
m
e
s
 
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
 
i
s
 
t
e
s
t
e
d
,
 
e
.
g
.
 
F
e
a
t
u
r
e
W
h
e
n
S
c
e
n
a
r
i
o
T
h
e
n
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
n
c
o
r
r
e
c
t
 
B
e
h
a
v
i
o
u
r
 
A
t
 
B
o
u
n
d
a
r
i
e
s
A
l
w
a
y
s
 
u
n
i
t
 
t
e
s
t
 
b
o
u
n
d
a
r
i
e
s
.
 
D
o
 
n
o
t
 
a
s
s
u
m
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
 
T
h
e
 
A
l
g
o
r
i
t
h
m
J
u
s
t
 
w
o
r
k
i
n
g
 
i
s
 
n
o
t
 
e
n
o
u
g
h
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
 
w
h
y
 
i
t
 
w
o
r
k
s
.
T
e
m
p
o
r
a
r
y
 
P
a
r
a
l
l
e
l
e
l
 
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
R
e
f
a
c
t
o
r
i
n
g
 
t
e
s
t
 
p
e
r
 
t
e
s
t
 
b
y
 
i
n
t
r
o
d
u
c
i
n
g
 
a
 
t
e
m
p
o
r
a
r
y
 
p
a
r
a
l
l
e
l
 
i
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
.
 
R
e
m
o
v
e
 
o
l
d
 
s
o
l
u
t
i
o
n
 
w
h
e
n
 
a
l
l
 
t
e
s
t
s
 
a
r
e
 
r
e
f
a
c
t
o
r
e
d
.
U
n
c
l
e
a
r
 
F
a
i
l
 
R
e
a
s
o
n
S
p
l
i
t
 
t
e
s
t
 
o
r
 
u
s
e
 
a
s
s
e
r
t
i
o
n
 
m
e
s
s
a
g
e
s
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
 
T
e
s
t
 
L
o
g
i
c
˚
’
ı
’
’
Z
}
µ
o
ˆ
v
}
ı
Z

À
˚

v
Ç

}
v
ˆ
]
ı
]
}
v

o
ı
˚
’
ı
o
}
P
]


˚


µ
’
˚
]
ı
[
’
Z

„
ˆ
ı
}
„
˚

ˆ
.
T
e
s
t
 
L
o
g
i
c
 
i
n
 
P
r
o
d
u
c
t
i
o
n
 
C
o
d
e
T
e
s
t
s
 
d
e
p
e
n
d
 
o
n
 
s
p
e
c
i
a
l
 
l
o
g
i
c
 
i
n
 
p
r
o
d
u
c
t
i
o
n
 
c
o
d
e
.
E
r
r
a
t
i
c
 
T
e
s
t
S
o
m
e
t
i
m
e
s
 
p
a
s
s
e
s
,
 
s
o
m
e
t
i
m
e
s
 
f
a
i
l
s
 
d
u
e
 
t
o
 
l
e
f
t
 
o
v
e
r
s
 
o
r
 
e
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
.
P
r
e
f
e
r
 
S
t
a
t
e
 
V
e
r
i
f
i
c
a
t
i
o
n
 
t
o
 
B
e
h
a
v
i
o
u
r
 
V
e
r
i
f
i
c
a
t
i
o
n
U
s
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
 
v
e
r
i
f
i
c
a
t
i
o
n
 
o
n
l
y
 
i
f
 
t
h
e
r
e
 
i
s
 
n
o
 
s
t
a
t
e
 
t
o
 
v
e
r
i
f
y
.
T
e
s
t
 
D
o
m
a
i
n
 
S
p
e
c
i
f
i
c
 
L
a
n
g
u
a
g
e
U
s
e
 
t
e
s
t
 
D
S
L
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
 
r
e
a
d
i
n
g
 
t
e
s
t
s
:
 
h
e
l
p
e
r
 
m
e
t
h
o
d
,
 
c
l
a
s
s
e
s
,
 
Y
```